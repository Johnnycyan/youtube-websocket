import type { ServerWebSocket } from "bun";
import { innertube } from "./youtube";
import { YTNodes } from "youtubei.js/web";

import { textMessageToJSON } from "../adapters/textMessage";
import { paidMessageToJSON } from "../adapters/paidMessage";

/** Someone please open a fucking PR to find a better name for this. It's 1AM and I can't think of shit. */
export async function finaliseStream(streamId: string, ws: ServerWebSocket) {
  const youtube = await innertube();

  const streamInfo = await youtube.getInfo(streamId);
  const liveChat = streamInfo.getLiveChat();

  if (!liveChat)
    return ws.close(1000, "Requested content has no available live chat");

  liveChat.on("start", () => {
    liveChat.applyFilter("LIVE_CHAT");
  });

  liveChat.on("chat-update", (action) => {
    if (ws.readyState > 1) return liveChat.stop();

    // Message deleted by mod or retracted by user
    if (action.is(YTNodes.MarkChatItemAsDeletedAction)) {
      const deleted = action.as(YTNodes.MarkChatItemAsDeletedAction);
      ws.send(JSON.stringify({ info: "deleted", message: deleted.target_item_id }));
      return;
    }

    if (action.is(YTNodes.RemoveChatItemAction)) {
      const removed = action.as(YTNodes.RemoveChatItemAction);
      ws.send(JSON.stringify({ info: "deleted", message: removed.target_item_id }));
      return;
    }

    // User banned/timed out — remove all their messages
    if (action.is(YTNodes.MarkChatItemsByAuthorAsDeletedAction)) {
      const banned = action.as(YTNodes.MarkChatItemsByAuthorAsDeletedAction);
      ws.send(JSON.stringify({ info: "banned", externalChannelId: banned.external_channel_id }));
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
    ws.close(1000, "Requested content's live chat has ended");
    return liveChat.stop();
  });

  liveChat.start();
}
