export function EventImageCredit({src,url}:{src:string;url:string}){
 const credit=TimelineImage.credit(src);
 if(!credit)return null;
 return <span><a href={url} target="_blank" rel="noreferrer">{credit.by}</a>{' · '}<a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>{' · 화면용 WebP 변환'}</span>;
}
