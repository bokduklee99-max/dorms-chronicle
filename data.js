let EVENTS = [];
function insertionIndex(placed, event) {
  const index = placed.findIndex(item => item.bounds.start > event.bounds.end);
  return index < 0 ? placed.length : index;
}
