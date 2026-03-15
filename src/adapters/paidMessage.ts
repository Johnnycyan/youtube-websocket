import { YTNodes } from "youtubei.js/web";

export function paidMessageToJSON(itemData: YTNodes.LiveChatPaidMessage) {
  return JSON.stringify({
    type: "superchat",
    id: itemData.id,
    purchase_amount: itemData.purchase_amount,
    hasMessage: !itemData.message.isEmpty(),
    message: itemData.message.text,
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
