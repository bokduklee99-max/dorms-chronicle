export async function readPackedMapData(response) {
  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  // Some servers send the file as a gzip-encoded response that fetch has already decoded.
  if (signature[0] === 31 && signature[1] === 139) {
    return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).json();
  }
  return JSON.parse(await blob.text());
}
