import { Innertube, Log } from "youtubei.js/web";
Log.setLevel(Log.Level.ERROR);

let innertubeInstance: Innertube | null = null;

export async function innertube(): Promise<Innertube> {
  if (!innertubeInstance) innertubeInstance = await Innertube.create();

  return innertubeInstance;
}
