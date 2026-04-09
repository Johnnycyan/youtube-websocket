import type { ElysiaWS } from "elysia/ws";
import { finaliseStream } from "../utils/finaliseStream";

export async function getStream(ws: ElysiaWS<any>) {
  if (!ws.data?.params?.id)
    return ws.close(1000, "Please specify a valid media identifier");

  if (!/^[A-Za-z0-9_-]{11}$/.test(ws.data.params.id))
    return ws.close(1000, "Please specify a valid media identifier");

  await finaliseStream(ws.data.params.id, ws.raw);
}
