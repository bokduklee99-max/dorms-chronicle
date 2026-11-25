globalThis.recordBackShortcut={
 keys:'Backspace Alt+ArrowLeft Meta+[',
 hint:'이전 항목 (Backspace · Mac ⌫)',
 handle(event,back){
  if(event.defaultPrevented||event.isComposing||event.shiftKey||event.ctrlKey)return;
  if(event.target instanceof HTMLElement&&
    (event.target.isContentEditable||event.target.matches('input, textarea, select')))return;
  const backspace=!event.altKey&&!event.metaKey&&event.key==='Backspace';
  const altLeft=event.altKey&&!event.metaKey&&event.key==='ArrowLeft';
  const commandBracket=event.metaKey&&!event.altKey&&event.key==='[';
  if(!backspace&&!altLeft&&!commandBracket)return;
  event.preventDefault();
  if(!event.repeat)back();
 }
};
