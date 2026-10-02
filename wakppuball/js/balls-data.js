/* 왁뿌볼 밸런스 데이터 — 보상에는 환생 배율이 게임에서 적용됩니다. */
const SOUND_SETTINGS = { folder: 'sounds/', extension: '.mp3', poolSize: 4, usePlaceholderSound: true };
const SOUND_PHASE_LIMITS = { early: 0.35, mid: 0.7 };
const DEFAULT_SOUNDS = { early:['tap1','tap2','tap3'], mid:['tap3','crack1'], late:['crack1','crack2'], final:['break'], pitch:1, pitchRandom:.06, volume:.9, volumeRandom:.1 };
const REBIRTH_COSTS = [500000,1500000,4000000,10000000,25000000,60000000,150000000,400000000,1000000000,2500000000];
const rebirthMultiplier = (count) => Math.pow(2, count);
const WAKPPU_BALLS = [
  {id:'yellow',name:'노란색 왁뿌볼',grade:'일반',gradeColor:'#aeb5bd',price:0,clicks:5,reward:1,design:{art:'plain',shape:'circle',colors:{light:'#fff0a3',mid:'#f3c83e',dark:'#a97812'},crack:{dark:'#72520b',light:'#fff7c9'},chip:'#edbd2c'},sound:{}},
  {id:'green',name:'초록색 왁뿌볼',grade:'일반',gradeColor:'#aeb5bd',price:10,clicks:7,reward:10,design:{art:'plain',shape:'circle',colors:{light:'#c9f8b6',mid:'#5fcf63',dark:'#2a8a3f'},crack:{dark:'#1c5a2a',light:'#eaffe3'},chip:'#55c25c'},sound:{}},
  {id:'strawberry',name:'딸기 왁뿌볼',grade:'과일',gradeColor:'#ff7890',price:100,clicks:9,reward:30,design:{art:'strawberry',shape:'strawberry',colors:{light:'#ff9c9c',mid:'#e8283f',dark:'#9a1128'},seed:'#ffe58c',leaf:['#78d95f','#2e8c3c'],crack:{dark:'#4a0613',light:'#ffd6d6'},chip:['#e8283f','#ff7a86']},sound:{pitch:1.04}},
  {id:'apple',name:'사과 왁뿌볼',grade:'과일',gradeColor:'#ff7890',price:250,clicks:11,reward:50,design:{art:'apple',shape:'circle',colors:{light:'#ff9b83',mid:'#df3034',dark:'#83151d'},crack:{dark:'#4e0710',light:'#ffd8d2'},chip:['#df3034','#ff7e67']},sound:{pitch:.98}},
  {id:'chocolate',name:'초콜릿 왁뿌볼',grade:'간식',gradeColor:'#d8a579',price:500,clicks:14,reward:100,design:{art:'chocolate',shape:'chocolate',colors:{light:'#a2683c',mid:'#6b3a1c',dark:'#2f1509'},crack:{dark:'#170802',light:'#e6b48a'},chip:['#5a2f17','#7b4526']},sound:{pitch:.94}},
  {id:'donut',name:'도넛 왁뿌볼',grade:'간식',gradeColor:'#d8a579',price:1500,clicks:18,reward:250,design:{art:'donut',shape:'circle',colors:{light:'#ffd4b1',mid:'#db995e',dark:'#905126'},crack:{dark:'#5a2a12',light:'#fff0df'},chip:['#f59aaa','#fff0b5','#9fe1ef']},sound:{pitch:1.1}},
  {id:'rainbow',name:'무지개 왁뿌볼',grade:'자연',gradeColor:'#71d6a0',price:2500,clicks:22,reward:400,design:{art:'rainbow',shape:'circle',colors:['#ff5f6d','#ffa24a','#ffe45c','#5ee07a','#4aa8ff','#a56bff'],crack:{dark:'#3a2a66',light:'#fff'},chip:['#ff5f6d','#ffe45c','#5ee07a','#4aa8ff']},sound:{pitch:1.06}},
  {id:'water',name:'물 왁뿌볼',grade:'자연',gradeColor:'#71d6a0',price:7000,clicks:27,reward:1000,design:{art:'water',shape:'circle',colors:{light:'#baf5ff',mid:'#47bce5',dark:'#1263ab'},crack:{dark:'#124a82',light:'#e6fcff'},chip:['#76dcf5','#d8fbff']},sound:{pitch:1.18}},
  {id:'emerald',name:'에메랄드 왁뿌볼',grade:'보석',gradeColor:'#52e3ad',price:10000,clicks:30,reward:1500,design:{art:'emerald',shape:'diamond',crack:{dark:'#075f49',light:'#dcfff2'},chip:['#29c995','#a3ffe1','#e6fff7']},sound:{pitch:1.08}},
  {id:'diamond',name:'다이아몬드 왁뿌볼',grade:'보석',gradeColor:'#73d7ff',price:15000,clicks:34,reward:2000,design:{art:'diamond',shape:'diamond',crack:{dark:'#2f5f9e',light:'#fff'},chip:['#d9f6ff','#fff','#8ad4ff']},sound:{pitch:1.22,volume:.95}},
  {id:'planet',name:'행성 왁뿌볼',grade:'우주',gradeColor:'#c19cff',price:100000,clicks:45,reward:10000,design:{art:'planet',shape:'circle',colors:{light:'#8468ff',mid:'#3a2390',dark:'#0c0632'},bands:[['#9a7dff',.55],['#ff8fcf',.42],['#43d3dc',.45],['#ffb862',.4],['#8468ff',.5]],crack:{dark:'#08031c',light:'#e2d6ff'},chip:['#8468ff','#43d3dc','#ffb862']},sound:{pitch:.8,volume:1}},
];
