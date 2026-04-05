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

  // Try to get all currently live streams from the channel's streams tab
  const channel = await youtube.getChannel(niceId).catch(() => null);
  if (channel?.has_live_streams) {
    const liveTab = await channel.getLiveStreams().catch(() => null);
    if (liveTab) {
      const liveVideos = liveTab.videos.filter((video) => video.is_live);

      if (liveVideos.length > 0) {
        let activeStreams = liveVideos.length;

        for (const video of liveVideos) {
          finaliseStream(video.id, ws, () => {
            activeStreams--;
            if (activeStreams === 0) {
              ws.close(1000, "All live streams have ended");
            }
          });
        }
        return;
      }
    }
  }

  // Fallback: resolve the /live URL directly (works for single-stream channels
  // and channels without a dedicated streams tab)
  const streamData = await youtube
    .resolveURL(`https://www.youtube.com/${niceId}/live`)
    .catch(() => null);

  if (!streamData?.payload?.videoId)
    return ws.close(1000, "Could not find stream by channel identifier");

  finaliseStream(streamData.payload.videoId, ws);
}
