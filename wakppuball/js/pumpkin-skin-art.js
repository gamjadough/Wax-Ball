/* Hand-drawn SVG, using the same round wax silhouette and specular overlay as live skins. */
window.WakppuPumpkinSkinArt={render(uid,ball,p){
 if(!p)return {defs:'',art:''};
 if(p.id==='eclipse')return window.WakppuEclipsePumpkin.art(uid);
 const id=p.id,c=ball.design.colors,accent=p.accent;
 const palettes={wisp:{rim:'#a6c9a0',shade:'#092f37',inner:'#073a44',eye:'#baffdf',core:'#dffff2'},ghost:{rim:'#e3d6c8',shade:'#45405e',inner:'#484064',eye:'#e4d8ff',core:'#fff5e6'},eclipse:{rim:'#e6b66b',shade:'#2e1322',inner:'#441123',eye:'#ffb160',core:'#ffe3a7'}};
 const t=palettes[id];
 const eyes={wisp:'M49 90Q61 80 80 82L84 103Q62 105 49 90Z M116 103L120 82Q139 80 151 90Q138 105 116 103Z',ghost:'M49 90Q65 73 81 86L83 106Q65 103 49 90Z M117 106L119 86Q135 73 151 90Q135 103 117 106Z',eclipse:'M45 91L76 79L85 103L67 100Z M115 103L124 79L155 91L133 100Z'};
 const mouths={wisp:'M51 119Q62 128 73 126L80 117L89 130L100 124L111 130L122 117L128 126Q143 124 150 117Q139 151 103 157Q68 154 51 119Z',ghost:'M55 122Q75 133 84 123L91 137L101 127L111 137L120 122Q133 130 145 120Q133 154 102 158Q71 154 55 122Z',eclipse:'M50 118L70 128L78 116L89 133L100 123L112 133L123 115L132 128L151 118Q139 154 102 159Q69 154 50 118Z'};
 const face=eyes[id]+' M96 105L101 96L106 105Z '+mouths[id];
 const ribs=[{x:57,w:31},{x:78,w:31},{x:100,w:30},{x:122,w:31},{x:143,w:31}].map(({x,w},i)=>`<ellipse cx="${x}" cy="106" rx="${w}" ry="74" fill="url(#${uid}-lobe-${i%2})"/><path d="M100 35Q${x-22} 55 ${x-18} 106Q${x-20} 150 100 178" fill="none" stroke="${t.shade}" stroke-opacity=".32" stroke-width="1.6"/>`).join('');
 const flecks=Array.from({length:16},(_,i)=>`<ellipse cx="${36+i*29%129}" cy="${49+i*43%111}" rx="${.6+i%3*.2}" ry="${.4+i%2*.2}" fill="${i%2?t.shade:accent}" opacity=".19"/>`).join('');
 const flames='<path d="M59 106C42 87 62 72 64 57C74 74 63 81 73 85C82 74 72 68 79 58C95 86 91 98 79 108Z"/><path d="M118 109C102 91 121 78 121 63C135 75 126 86 135 88C147 79 137 69 143 60C156 88 148 101 136 111Z"/><path d="M73 155C57 135 87 123 85 105C102 119 89 131 100 138C115 129 109 113 120 103C140 136 115 148 120 159Z"/>';
 const energy={
  wisp:`<g class="pumpkin-wisp-flame" fill="url(#${uid}-soul-fire)">${flames}</g>`,
  ghost:`<g class="pumpkin-ghost-spirit" fill="url(#${uid}-soul-fire)"><path d="M43 143C63 135 51 93 75 70C68 98 95 97 92 118C87 139 111 148 103 171Z"/><path d="M99 163C125 138 102 99 133 65C124 101 146 99 151 122C149 143 130 164 99 163Z"/></g>`,
  eclipse:`<g class="pumpkin-eclipse-moon"><ellipse cx="101" cy="136" rx="50" ry="26" fill="url(#${uid}-soul-fire)"/><path d="M44 92L79 84M121 84L156 92" stroke="#ffe7af" stroke-width="5"/></g>`
 };
 const crest=id==='wisp'?`<g class="pumpkin-wisp-orbit" fill="none" stroke="${t.rim}" stroke-width=".9" opacity=".7"><path d="M49 62Q34 82 36 107M151 62Q166 82 164 107M38 114Q42 134 53 142M162 114Q158 134 147 142"/><path d="M60 57L65 52L70 57M130 57L135 52L140 57"/></g><path d="M98 54Q86 48 96 36Q93 46 104 45Q111 51 104 58" fill="${t.eye}" opacity=".8"/>`:id==='ghost'?`<g fill="none" stroke="${t.rim}" stroke-width="1" opacity=".7"><path d="M47 64Q34 95 47 124M153 64Q166 95 153 124M61 151Q100 175 139 151"/><path d="M86 53Q100 63 114 53M90 48Q100 55 110 48"/></g><path d="M94 37Q84 48 94 59Q101 65 108 56Q99 60 97 53Q102 45 94 37Z" fill="${t.eye}" opacity=".75"/>`:`<g fill="none" stroke="url(#${uid}-metal)" stroke-width="1.3"><circle cx="100" cy="103" r="72"/><circle cx="100" cy="103" r="68" stroke-opacity=".35"/><path d="M43 62L49 67L45 76M157 62L151 67L155 76M50 142L58 143L60 152M150 142L142 143L140 152M87 171L100 177L113 171"/></g><g class="pumpkin-eclipse-seal" fill="${t.rim}">${[0,1,2,3,4,5,6,7].map(i=>`<path d="M100 29L102 35L100 39L98 35Z" transform="rotate(${i*45} 100 103)"/>`).join('')}</g><path d="M108 39A17 17 0 1 0 114 65A14 14 0 0 1 108 39Z" fill="url(#${uid}-metal)" stroke="#ffcf80" stroke-width=".5"/>`;
 const defs=`
 <radialGradient id="${uid}-pumpkin-body" cx=".32" cy=".24" r=".85"><stop stop-color="${c.light}"/><stop offset=".38" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
 <linearGradient id="${uid}-lobe-0"><stop stop-color="${t.shade}" stop-opacity=".35"/><stop offset=".43" stop-color="${c.light}" stop-opacity=".16"/><stop offset=".68" stop-color="${c.light}" stop-opacity=".06"/><stop offset="1" stop-color="${t.shade}" stop-opacity=".48"/></linearGradient>
 <linearGradient id="${uid}-lobe-1"><stop stop-color="${t.shade}" stop-opacity=".23"/><stop offset=".4" stop-color="${c.light}" stop-opacity=".13"/><stop offset="1" stop-color="${t.shade}" stop-opacity=".3"/></linearGradient>
 <radialGradient id="${uid}-cavity" cx=".5" cy=".8" r=".85"><stop stop-color="${t.eye}"/><stop offset=".37" stop-color="${t.eye}" stop-opacity=".8"/><stop offset="1" stop-color="${t.inner}"/></radialGradient>
 <linearGradient id="${uid}-soul-fire" x1="0" y1="1" x2=".2" y2="0"><stop stop-color="${t.eye}"/><stop offset=".45" stop-color="${t.core}"/><stop offset="1" stop-color="${t.eye}" stop-opacity="0"/></linearGradient>
 <linearGradient id="${uid}-metal" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff0c3"/><stop offset=".27" stop-color="${t.rim}"/><stop offset=".52" stop-color="#75512b"/><stop offset=".7" stop-color="${t.rim}"/><stop offset="1" stop-color="#83613d"/></linearGradient>
 <clipPath id="${uid}-carved-face"><path d="${face}"/></clipPath><clipPath id="${uid}-wax-body"><circle cx="100" cy="100" r="81"/></clipPath>`;
 const veil=id==='ghost'?`<path d="M34 77Q51 45 77 40Q81 50 76 65L72 91Q69 99 65 92L63 67Q57 64 52 77L47 113Q43 126 39 115L39 88Q37 83 34 91Z M123 40Q149 46 166 78L161 108Q157 124 153 112L151 80Q148 70 143 70L139 99Q135 108 132 97L133 62Q128 54 123 40Z" fill="${c.light}" fill-opacity=".32" stroke="${t.rim}" stroke-opacity=".28" stroke-width=".7"/>`:'';
 const art=`<g data-pumpkin-skin="${id}" data-wax-material="polished"><circle cx="100" cy="100" r="82" fill="url(#${uid}-pumpkin-body)"/><g clip-path="url(#${uid}-wax-body)">${ribs}${flecks}${veil}</g><circle cx="100" cy="100" r="79.5" fill="none" stroke="${accent}" stroke-width=".8" opacity=".28"/>${crest}
 <path d="M88 42Q86 25 105 19L115 27Q100 28 104 43" fill="${t.shade}" stroke="${t.rim}" stroke-width="1.1"/><path d="M93 38Q93 29 106 25" fill="none" stroke="${t.rim}" stroke-width="1.5" opacity=".6"/>
 <path d="${face}" transform="translate(0 1.6)" fill="none" stroke="${c.light}" stroke-width="2.4" opacity=".55"/><path d="${face}" fill="url(#${uid}-cavity)" stroke="${t.shade}" stroke-width="3.5" stroke-linejoin="round"/>
 <g clip-path="url(#${uid}-carved-face)"><g data-pumpkin-energy opacity=".65">${energy[id]}</g><path d="${face}" transform="translate(0 2.5)" fill="none" stroke="${t.inner}" stroke-width="2.5" opacity=".65"/></g>
 <path d="M44 69Q52 43 79 37M38 86L40 78" fill="none" stroke="${c.light}" stroke-width="2" stroke-linecap="round" opacity=".28"/></g>`;
 return {defs,art};
}};
