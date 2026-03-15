import type { YTNodes } from "youtubei.js/web";

export function textMessageToJSON(itemData: YTNodes.LiveChatTextMessage) {
  return JSON.stringify({
    type: "message",
    id: itemData.id,
    message: itemData.message.text,
    runs: itemData.message.runs || [],
    author: {
      name: itemData.author.name,
      id: itemData.author.id,
      verified: itemData.author.is_verified || false,
      moderator: itemData.author.is_moderator || false,
      badges: itemData.author.badges?.map((badge: any) => {
        if (badge.type === "LiveChatAuthorBadge") {
          return {
            url: badge.custom_thumbnail ? badge.custom_thumbnail[0]?.url : "",
            tooltip: badge.tooltip
          }
        }
      }) || []
    },
    unix: itemData.timestamp || 0,
  });
}
