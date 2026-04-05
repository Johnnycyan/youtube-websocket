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

  const channel = await youtube.getChannel(niceId).catch(() => null);
  if (!channel) return ws.close(1000, "Could not find channel by identifier");

  if (!channel.has_live_streams)
    return ws.close(1000, "Could not find any live streams for this channel");

  const liveTab = await channel.getLiveStreams().catch(() => null);
  if (!liveTab)
    return ws.close(1000, "Could not find any live streams for this channel");

  const liveVideos = liveTab.videos.filter((video) => video.is_live);

  if (liveVideos.length === 0)
    return ws.close(1000, "Could not find any live streams for this channel");

  let activeStreams = liveVideos.length;

  for (const video of liveVideos) {
    finaliseStream(video.id, ws, () => {
      activeStreams--;
      if (activeStreams === 0) {
        ws.close(1000, "All live streams have ended");
      }
    });
  }
}
