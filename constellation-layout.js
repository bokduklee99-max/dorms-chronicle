const colors = ['#4979e8', '#df6c46', '#21a896', '#9a71d2', '#d9a532', '#cf658b', '#72a9b0', '#6f8b49', '#ac805c', '#6682b4', '#a65373', '#63717b'];

/**
 * @param {import('./src/metro-model.ts').EventRecord[]} events
 * @param {import('./src/metro-model.ts').Topic[]} topics
 */
export function constellationLayout(events, topics) {
  const anchors = topics.filter(topic => topic.parent_topic_id).map((topic, index, groups) => {
    const angle = index / groups.length * Math.PI * 2 - .5;
    return {
      id: topic.topic_id,
      label: topic.name.includes('페레스트') ? '냉전 종식' : topic.name,
      color: colors[index % colors.length],
      x: 260 + 195 * Math.cos(angle),
      y: 140 + 88 * Math.sin(angle),
    };
  });

  const stars = events.flatMap(event => {
    const groups = anchors.filter(anchor => event.directTopicIds.includes(anchor.id));
    if (!groups.length) return [];
    const seed = [...event.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const x = groups.reduce((sum, anchor) => sum + anchor.x, 0) / groups.length + Math.sin(seed * 1.7) * 15;
    const y = groups.reduce((sum, anchor) => sum + anchor.y, 0) / groups.length + Math.cos(seed * .71) * 16;
    return [{event, groups, x, y}];
  });

  return {anchors, stars};
}
