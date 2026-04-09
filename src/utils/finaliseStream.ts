import { innertube } from "./youtube";
import { YTNodes } from "youtubei.js/web";

import { textMessageToJSON } from "../adapters/textMessage";
import { paidMessageToJSON } from "../adapters/paidMessage";

interface WsLike {
  readonly readyState: number;
  send(data: string): unknown;
  close(code?: number, reason?: string): void;
}

/** Someone please open a fucking PR to find a better name for this. It's 1AM and I can't think of shit. */
export async function finaliseStream(
  streamId: string,
  ws: WsLike,
  onEnd?: () => void,
) {
  const youtube = await innertube();

  const streamInfo = await youtube.getInfo(streamId);
  const liveChat = streamInfo.getLiveChat();

  console.log("Youtube: finalising for stream:", streamId);

  if (!liveChat) {
    if (onEnd) return onEnd();
    console.log("YouTube: Requested content has no available live chat");
    return ws.close(1000, "Requested content has no available live chat");
  }

  // Bypass the SmoothedQueue entirely so messages are emitted instantly with a 1s poll interval.
  // The original callback re-triggers the private _pollLivechat method. Passing 10+ dummy
  // actions takes its "fire-and-forget → immediate re-poll" path, avoiding the 2s empty-array wait.
  // The dummy actions have is() returning false, so the chat-update handler silently ignores them.
  const origCallback = liveChat.smoothed_queue.callback!;
  const noopActions = Array.from({ length: 10 }, () => ({
    is: () => false,
  })) as any;
  liveChat.smoothed_queue.enqueueActionGroup = (group: any) => {
    for (const action of [group].flat()) {
      liveChat.emit("chat-update", action);
    }
    setTimeout(() => origCallback(noopActions), 1000);
  };

  liveChat.on("start", () => {
    liveChat.applyFilter("LIVE_CHAT");
  });

  liveChat.on("chat-update", (action) => {
    if (ws.readyState > 1) return liveChat.stop();

    // Message deleted by mod or retracted by user
    if (action.is(YTNodes.MarkChatItemAsDeletedAction)) {
      const deleted = action.as(YTNodes.MarkChatItemAsDeletedAction);
      ws.send(
        JSON.stringify({ info: "deleted", message: deleted.target_item_id }),
      );
      return;
    }

    if (action.is(YTNodes.RemoveChatItemAction)) {
      const removed = action.as(YTNodes.RemoveChatItemAction);
      ws.send(
        JSON.stringify({ info: "deleted", message: removed.target_item_id }),
      );
      return;
    }

    // User banned/timed out — remove all their messages
    if (
      action.is(YTNodes.MarkChatItemsByAuthorAsDeletedAction) ||
      action.is(YTNodes.RemoveChatItemByAuthorAction)
    ) {
      const banned = action.is(YTNodes.MarkChatItemsByAuthorAsDeletedAction)
        ? action.as(YTNodes.MarkChatItemsByAuthorAsDeletedAction)
        : action.as(YTNodes.RemoveChatItemByAuthorAction);
      ws.send(
        JSON.stringify({
          info: "banned",
          externalChannelId: banned.external_channel_id,
        }),
      );
      return;
    }

    if (!action.is(YTNodes.AddChatItemAction)) return;

    const item = action.as(YTNodes.AddChatItemAction).item;

    if (!item) return;

    switch (item.type) {
      case "LiveChatTextMessage":
        ws.send(textMessageToJSON(item.as(YTNodes.LiveChatTextMessage)));
        break;

      case "LiveChatPaidMessage":
        ws.send(paidMessageToJSON(item.as(YTNodes.LiveChatPaidMessage)));
        break;
    }
  });

  liveChat.on("end", () => {
    console.log("YouTube: Live chat has ended for stream:", streamId);
    liveChat.stop();
    if (onEnd) {
      onEnd();
    } else {
      ws.close(1000, "Requested content's live chat has ended");
    }
  });

  liveChat.start();
}
