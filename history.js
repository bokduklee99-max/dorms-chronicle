'use strict';
globalThis.HistoryViews = (() => {
  const DAY=86400000;
  const date=stamp=>new Date(stamp).toISOString().slice(0,10);
  function leadersDuring(tenures,actorId,bounds) {
    return tenures.filter(row=>row.actorId===actorId&&row.status==='verified'&&row.start.start<=bounds.end&&(!row.end||row.end.end>=bounds.start));
  }
  function eventLeaders(event,actors,tenures) {
    return actors.filter(actor=>actor.actor_type==='state'&&event.actorIds.includes(actor.actor_id)).map(country=>{
      const people=new Map();
      for(const tenure of leadersDuring(tenures,country.actor_id,event.bounds)) {
        if(!people.has(tenure.person))people.set(tenure.person,{person:tenure.person,tenures:[]});
        people.get(tenure.person).tenures.push(tenure);
      }
      return {country,people:[...people.values()]};
    });
  }
  function countryRows(events,actors,tenures,decade,basis='actors') {
    const key=basis==='tags'?'tagActorIds':'actorIds';
    const visible=events.filter(event=>event.year>=decade&&event.year<decade+10);
    const used=new Set(visible.flatMap(event=>event[key]||[]));
    if(Number.isInteger(decade)&&basis!=='tags')for(const tenure of tenures)if(tenure.status==='verified'&&tenure.start.start<=SheetData.dateRange(String(decade+9)).end&&(!tenure.end||tenure.end.end>=SheetData.dateRange(String(decade)).start))used.add(tenure.actorId);
    const countries=actors.filter(actor=>['state','territory'].includes(actor.actor_type)&&used.has(actor.actor_id));
    const ids=new Set(countries.map(country=>country.actor_id));
    const missing=visible.some(event=>!(event[key]||[]).some(id=>ids.has(id)));
    const columns=[...countries.map(country=>({id:country.actor_id,name:country.name})),...(missing?[{id:'unassigned',name:'국가 미연결'}]:[])];
    const rows=[];
    for(let year=decade;year<decade+10;year++) {
      const inYear=visible.filter(event=>event.year===year);
      if(!inYear.length)continue;
      rows.push({year,cells:columns.map(column=>({id:column.id,leaders:column.id==='unassigned'?[]:leadersDuring(tenures,column.id,SheetData.dateRange(String(year))),events:inYear.filter(event=>column.id==='unassigned'?!(event[key]||[]).some(id=>ids.has(id)):(event[key]||[]).includes(column.id))}))});
    }
    return {columns,rows,count:visible.length};
  }
  function network(events,relations,selectedId,basis='topics') {
    const center=events.find(event=>event.id===selectedId)||events[0];
    if(!center)return {center:null,nodes:[],edges:[],total:0};
    const byId=new Map(events.map(event=>[event.id,event]));
    const connected=new Map();
    if(basis==='relations') {
      for(const relation of relations.filter(row=>row.status==='verified')) {
        const other=relation.from===center.id?relation.to:relation.to===center.id?relation.from:null;
        if(other&&byId.has(other)) {
          if(!connected.has(other))connected.set(other,[]);
          connected.get(other).push(relation);
        }
      }
    } else for(const event of events) {
      if(event.id===center.id)continue;
      const common=(event.directTopicIds||[]).filter(id=>(center.directTopicIds||[]).includes(id));
      if(common.length)connected.set(event.id,[{from:center.id,to:event.id,topics:common,type:'shared_topic'}]);
    }
    // shortcut: Show six neighbours around one event; use a pannable full graph if whole-network comparison is needed.
    const nodes=[...connected.keys()].map(id=>byId.get(id)).sort((a,b)=>Math.abs(a.bounds.start-center.bounds.start)-Math.abs(b.bounds.start-center.bounds.start)||a.id.localeCompare(b.id)).slice(0,6);
    return {center,nodes,edges:nodes.flatMap(node=>connected.get(node.id)),total:connected.size};
  }
  function exactDays(events) {
    const groups=new Map();
    for(const event of events.filter(event=>/^\d{4}-\d{2}-\d{2}$/.test(event.date)&&event.dateQualifier!=='approximate')) {
      if(!groups.has(event.date))groups.set(event.date,[]);
      groups.get(event.date).push(event);
    }
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,events])=>({date,events}));
  }
  function revealAt(groups,cursor,start=groups[0]?.date) {
    return {today:groups.find(group=>group.date===cursor)?.events||[],past:groups.filter(group=>group.date>=start&&group.date<cursor),next:groups.find(group=>group.date>cursor)?.date||null};
  }
  const nextDay=value=>date(SheetData.dateRange(value).start+DAY);
  return {countryRows,network,exactDays,revealAt,nextDay,leadersDuring,eventLeaders};
})();
