import type { ElysiaWS } from "elysia/ws";
import { innertube } from "../utils/youtube";
import { finaliseStream } from "../utils/finaliseStream";

export async function getChannel(ws: ElysiaWS<any>) {
  if (!ws.data?.params?.id)
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

  console.log("YouTube: Getting data for:", niceId);
  console.log("YouTube: Primary stream detected:", primaryVideoId);

  // Check for additional live streams beyond the primary one
  let additionalVideoIds: string[] = [];
  try {
    // getChannel() requires a UC... channel ID — use it directly if already in that format,
    // otherwise attempt to resolve it from the video's basic info
    let channelId: string | undefined = /^UC.{22}$/.test(niceId)
      ? niceId
      : undefined;
    if (!channelId) {
      const videoInfo = await youtube.getInfo(primaryVideoId);
      channelId = videoInfo.secondary_info?.owner?.author?.id;
    }
    if (!channelId) throw new Error("Could not resolve channel ID from video");
    const channel = await youtube.getChannel(channelId);
    if (channel.has_live_streams) {
      const liveTab = await channel.getLiveStreams();
      additionalVideoIds = liveTab.videos
        .filter((video: any) => {
          try {
            return video.is_live && video.id !== primaryVideoId;
          } catch {
            return false;
          }
        })
        .map((video: any) => video.id as string);
      additionalVideoIds.length > 0 &&
        console.log(
          `YouTube ${niceId}: Additional live streams detected:`,
          additionalVideoIds,
        );
    }
  } catch (exception) {
    // Multi-stream detection failed; continue with the primary stream only
    console.log(
      `YouTube ${niceId}: Failed to detect additional live streams:`,
      exception,
    );
  }

  if (additionalVideoIds.length === 0) {
    // Single stream — use the simple path with no onEnd callback
    finaliseStream(primaryVideoId, ws.raw);
  } else {
    // Multiple streams — track them all
    const allVideoIds = [primaryVideoId, ...additionalVideoIds];
    let activeStreams = allVideoIds.length;

    for (const id of allVideoIds) {
      finaliseStream(id, ws.raw, () => {
        activeStreams--;
        if (activeStreams === 0) {
          ws.close(1000, "All live streams have ended");
        }
      });
    }
  }
}
