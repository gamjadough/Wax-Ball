// Shared badge presentation for rankings and profiles. Ownership stays server-side.
(() => {
 const testerLabel='2026년 10월 테스터 배지';
 const isTester=label=>label===testerLabel;
 const className=label=>'monthly-badge'+(isTester(label)?' tester-badge':'');
 const prefix=label=>isTester(label)?'':'🏅 ';
 function paint(node,label){node.className=className(label);node.textContent=label?prefix(label)+label:'';node.hidden=!label;}
 window.WakppuBadges={isTester,className,prefix,paint};
})();
