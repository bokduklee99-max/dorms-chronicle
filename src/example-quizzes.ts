import type {QuizPlan} from './authored-quiz';

const items=(...ids:string[])=>ids.map(id=>({id}));

export const exampleQuizzes=[
 {
  kind:'blank',label:'빈칸 퀴즈',description:'식민 통치와 독립운동을 다룬 기록에서 빈칸 9개를 채웁니다.',
  plan:{kind:'blank',title:'기록의 빈칸 채우기',categories:['japan_context','japan_military_rule'],items:[
   {id:'E206',blanks:['title-11u9ozd:3:6','body-11u9ozd:3:6','body-11u9ozd:0:2']},
   {id:'E272',blanks:['title']},{id:'E238',blanks:['title-1pkzy8t:0:3']},
   {id:'E270',blanks:['title-8wik18:1:6','body-8wik18:3:6']},
   {id:'E276',blanks:['title-mrzzm5:4:9']},{id:'E310',blanks:['title']},
  ]},
 },
 {
  kind:'order',label:'사건 순서 퀴즈',description:'대한 광복회부터 광주 학생 항일 운동까지 세 사건을 시간순으로 놓습니다.',
  plan:{kind:'order',title:'독립운동의 순서 맞추기',items:items('E247','E278','E260')},
 },
 {
  kind:'person',label:'관련 인물 퀴즈',description:'의열단 결성, 봉오동 전투, 물산 장려 운동의 기록을 읽고 인물을 고릅니다.',
  plan:{kind:'person',title:'사건 속 인물 찾기',items:[
   {id:'E187',key:'person-175nqo2'},{id:'E278',key:'person-vv7cfq'},{id:'E249',key:'person-pby642'},
  ]},
 },
 {
  kind:'insertion',label:'하나씩 끼워넣기',description:'새 사건이 들어갈 자리를 찾아 독립운동 연표를 완성합니다.',
  plan:{kind:'insertion',title:'독립운동 연표 완성하기',roundCount:1,questionsPerRound:3,items:items('E187','E278','E279','E255')},
 },
] satisfies {kind:'blank'|'order'|'person'|'insertion';label:string;description:string;plan:QuizPlan}[];
