export function dateLabel(date:string,groupYear?:number){
 const [year,month,day]=date.split('-');
 const prefix=Number(year)===groupYear?'':year+'년';
 if(!month)return year+'년';
 return [prefix,Number(month)+'월',day&&Number(day)+'일'].filter(Boolean).join(' ');
}

export function periodLabel(start:string,end:string){
 if(start===end)return dateLabel(start);
 if(/^\d{4}$/.test(start)&&/^\d{4}$/.test(end))return start+'–'+end+'년';
 return dateLabel(start)+' – '+dateLabel(end);
}

export function categoryFilterLabel(name:string,kind:string,start?:string,end?:string){
 if(kind!=='period')return name;
 const range=start&&end?periodLabel(start,end):start?dateLabel(start)+'부터':end?dateLabel(end)+'까지':'';
 return range?`${name} (${range})`:name;
}
