import type {HTMLAttributes} from 'react';

declare module 'react' {
 namespace JSX {
  interface IntrinsicElements {
   'dorms-creator': HTMLAttributes<HTMLElement> & {ids: string};
  }
 }
}

const creatorIds = [
 '6a321a5b-e41f-43bf-bb8e-8b4040b2ac3f',
 '1b4de3ef-8ff2-453a-baca-687744ca9146',
 'd1f900e5-7178-42aa-973d-499b0aef8c3e',
 'a228c150-039e-4ee4-9915-e7b5eb73e3ad',
 'e0129b55-2eb5-4cc6-bf87-bb5e7d0af267',
].join(',');

export function CreatorCredit(){
 return <div className="creator-credit"><span>만든 사람</span><dorms-creator ids={creatorIds}/></div>;
}
