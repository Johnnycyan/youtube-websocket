import type { ServerWebSocket } from "bun";
import { innertube } from "../utils/youtube";
import { finaliseStream } from "../utils/finaliseStream";

export async function getChannel(ws: ServerWebSocket) {
  if (!ws.data.params.id)
    return ws.close(1000, "Please specify a valid channel identifier");

  const niceId = /^UC.{22}$/.test(ws.data.params.id)
    ? ws.data.params.id
    : "@" + ws.data.params.id.replace("@", "");

  const youtube = await innertube();

  // Resolve the primary stream quickly via the /live URL (proven, fast)
  const streamData = await youtube
    .resolveURL(`https://www.youtube.com/${niceId}/live`)
    .catch(() => null);

  if (!streamData?.payload?.videoId)
    return ws.close(1000, "Could not find stream by channel identifier");

  const primaryVideoId = streamData.payload.videoId;

  // Check for additional live streams beyond the primary one
  let additionalVideoIds: string[] = [];
  try {
    const channel = await youtube.getChannel(niceId);
    if (channel.has_live_streams) {
      const liveTab = await channel.getLiveStreams();
      additionalVideoIds = liveTab.videos
        .filter((video) => {
          try {
            return video.is_live && video.id !== primaryVideoId;
          } catch {
            return false;
          }
        })
        .map((video) => video.id);
    }
  } catch {
    // Multi-stream detection failed; continue with the primary stream only
  }

  if (additionalVideoIds.length === 0) {
    // Single stream — use the simple path with no onEnd callback
    finaliseStream(primaryVideoId, ws);
  } else {
    // Multiple streams — track them all
    const allVideoIds = [primaryVideoId, ...additionalVideoIds];
    let activeStreams = allVideoIds.length;

    for (const id of allVideoIds) {
      finaliseStream(id, ws, () => {
        activeStreams--;
        if (activeStreams === 0) {
          ws.close(1000, "All live streams have ended");
        }
      });
    }
  }
}
