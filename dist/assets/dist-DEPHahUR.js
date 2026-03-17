import{o as e,r as t}from"./createLucideIcon-BYwzQyCU.js";var n={data:``},r=e=>{if(typeof window==`object`){let t=(e?e.querySelector(`#_goober`):window._goober)||Object.assign(document.createElement(`style`),{innerHTML:` `,id:`_goober`});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||n},i=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,a=/\/\*[^]*?\*\/|  +/g,o=/\n+/g,s=(e,t)=>{let n=``,r=``,i=``;for(let a in e){let o=e[a];a[0]==`@`?a[1]==`i`?n=a+` `+o+`;`:r+=a[1]==`f`?s(o,a):a+`{`+s(o,a[1]==`k`?``:t)+`}`:typeof o==`object`?r+=s(o,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+` `+t:t)):a):o!=null&&(a=/^--/.test(a)?a:a.replace(/[A-Z]/g,`-$&`).toLowerCase(),i+=s.p?s.p(a,o):a+`:`+o+`;`)}return n+(t&&i?t+`{`+i+`}`:i)+r},c={},l=e=>{if(typeof e==`object`){let t=``;for(let n in e)t+=n+l(e[n]);return t}return e},u=(e,t,n,r,u)=>{let d=l(e),f=c[d]||(c[d]=(e=>{let t=0,n=11;for(;t<e.length;)n=101*n+e.charCodeAt(t++)>>>0;return`go`+n})(d));if(!c[f]){let t=d===e?(e=>{let t,n,r=[{}];for(;t=i.exec(e.replace(a,``));)t[4]?r.shift():t[3]?(n=t[3].replace(o,` `).trim(),r.unshift(r[0][n]=r[0][n]||{})):r[0][t[1]]=t[2].replace(o,` `).trim();return r[0]})(e):e;c[f]=s(u?{[`@keyframes `+f]:t}:t,n?``:`.`+f)}let p=n&&c.g?c.g:null;return n&&(c.g=c[f]),((e,t,n,r)=>{r?t.data=t.data.replace(r,e):t.data.indexOf(e)===-1&&(t.data=n?e+t.data:t.data+e)})(c[f],t,r,p),f},d=(e,t,n)=>e.reduce((e,r,i)=>{let a=t[i];if(a&&a.call){let e=a(n),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?`.`+t:e&&typeof e==`object`?e.props?``:s(e,``):!1===e?``:e}return e+r+(a??``)},``);function f(e){let t=this||{},n=e.call?e(t.p):e;return u(n.unshift?n.raw?d(n,[].slice.call(arguments,1),t.p):n.reduce((e,n)=>Object.assign(e,n&&n.call?n(t.p):n),{}):n,r(t.target),t.g,t.o,t.k)}var p,m,h;f.bind({g:1});var g=f.bind({k:1});function _(e,t,n,r){s.p=t,p=e,m=n,h=r}function v(e,t){let n=this||{};return function(){let r=arguments;function i(a,o){let s=Object.assign({},a),c=s.className||i.className;n.p=Object.assign({theme:m&&m()},s),n.o=/ *go\d+/.test(c),s.className=f.apply(n,r)+(c?` `+c:``),t&&(s.ref=o);let l=e;return e[0]&&(l=s.as||e,delete s.as),h&&l[0]&&h(s),p(l,s)}return t?t(i):i}}var y=e(t(),1),ee=e=>typeof e==`function`,b=(e,t)=>ee(e)?e(t):e,x=(()=>{let e=0;return()=>(++e).toString()})(),S=(()=>{let e;return()=>{if(e===void 0&&typeof window<`u`){let t=matchMedia(`(prefers-reduced-motion: reduce)`);e=!t||t.matches}return e}})(),C=20,w=`default`,T=(e,t)=>{let{toastLimit:n}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,n)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return T(e,{type:e.toasts.find(e=>e.id===r.id)?1:0,toast:r});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(e=>e.id===i||i===void 0?{...e,dismissed:!0,visible:!1}:e)};case 4:return t.toastId===void 0?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let a=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+a}))}}},E=[],D={toasts:[],pausedAt:void 0,settings:{toastLimit:C}},O={},k=(e,t=w)=>{O[t]=T(O[t]||D,e),E.forEach(([e,n])=>{e===t&&n(O[t])})},A=e=>Object.keys(O).forEach(t=>k(e,t)),te=e=>Object.keys(O).find(t=>O[t].toasts.some(t=>t.id===e)),j=(e=w)=>t=>{k(t,e)},M={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},N=(e={},t=w)=>{let[n,r]=(0,y.useState)(O[t]||D),i=(0,y.useRef)(O[t]);(0,y.useEffect)(()=>(i.current!==O[t]&&r(O[t]),E.push([t,r]),()=>{let e=E.findIndex(([e])=>e===t);e>-1&&E.splice(e,1)}),[t]);let a=n.toasts.map(t=>({...e,...e[t.type],...t,removeDelay:t.removeDelay||e[t.type]?.removeDelay||e?.removeDelay,duration:t.duration||e[t.type]?.duration||e?.duration||M[t.type],style:{...e.style,...e[t.type]?.style,...t.style}}));return{...n,toasts:a}},P=(e,t=`blank`,n)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:`status`,"aria-live":`polite`},message:e,pauseDuration:0,...n,id:n?.id||x()}),F=e=>(t,n)=>{let r=P(t,e,n);return j(r.toasterId||te(r.id))({type:2,toast:r}),r.id},I=(e,t)=>F(`blank`)(e,t);I.error=F(`error`),I.success=F(`success`),I.loading=F(`loading`),I.custom=F(`custom`),I.dismiss=(e,t)=>{let n={type:3,toastId:e};t?j(t)(n):A(n)},I.dismissAll=e=>I.dismiss(void 0,e),I.remove=(e,t)=>{let n={type:4,toastId:e};t?j(t)(n):A(n)},I.removeAll=e=>I.remove(void 0,e),I.promise=(e,t,n)=>{let r=I.loading(t.loading,{...n,...n?.loading});return typeof e==`function`&&(e=e()),e.then(e=>{let i=t.success?b(t.success,e):void 0;return i?I.success(i,{id:r,...n,...n?.success}):I.dismiss(r),e}).catch(e=>{let i=t.error?b(t.error,e):void 0;i?I.error(i,{id:r,...n,...n?.error}):I.dismiss(r)}),e};var L=1e3,R=(e,t=`default`)=>{let{toasts:n,pausedAt:r}=N(e,t),i=(0,y.useRef)(new Map).current,a=(0,y.useCallback)((e,t=L)=>{if(i.has(e))return;let n=setTimeout(()=>{i.delete(e),o({type:4,toastId:e})},t);i.set(e,n)},[]);(0,y.useEffect)(()=>{if(r)return;let e=Date.now(),i=n.map(n=>{if(n.duration===1/0)return;let r=(n.duration||0)+n.pauseDuration-(e-n.createdAt);if(r<0){n.visible&&I.dismiss(n.id);return}return setTimeout(()=>I.dismiss(n.id,t),r)});return()=>{i.forEach(e=>e&&clearTimeout(e))}},[n,r,t]);let o=(0,y.useCallback)(j(t),[t]),s=(0,y.useCallback)(()=>{o({type:5,time:Date.now()})},[o]),c=(0,y.useCallback)((e,t)=>{o({type:1,toast:{id:e,height:t}})},[o]),l=(0,y.useCallback)(()=>{r&&o({type:6,time:Date.now()})},[r,o]),u=(0,y.useCallback)((e,t)=>{let{reverseOrder:r=!1,gutter:i=8,defaultPosition:a}=t||{},o=n.filter(t=>(t.position||a)===(e.position||a)&&t.height),s=o.findIndex(t=>t.id===e.id),c=o.filter((e,t)=>t<s&&e.visible).length;return o.filter(e=>e.visible).slice(...r?[c+1]:[0,c]).reduce((e,t)=>e+(t.height||0)+i,0)},[n]);return(0,y.useEffect)(()=>{n.forEach(e=>{if(e.dismissed)a(e.id,e.removeDelay);else{let t=i.get(e.id);t&&(clearTimeout(t),i.delete(e.id))}})},[n,a]),{toasts:n,handlers:{updateHeight:c,startPause:s,endPause:l,calculateOffset:u}}},z=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,B=g`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,V=g`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,H=v(`div`)`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||`#ff4b4b`};
  position: relative;
  transform: rotate(45deg);

  animation: ${z} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${B} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||`#fff`};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${V} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,U=g`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,W=v(`div`)`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||`#e0e0e0`};
  border-right-color: ${e=>e.primary||`#616161`};
  animation: ${U} 1s linear infinite;
`,G=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,K=g`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,ne=v(`div`)`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||`#61d345`};
  position: relative;
  transform: rotate(45deg);

  animation: ${G} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${K} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||`#fff`};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,q=v(`div`)`
  position: absolute;
`,J=v(`div`)`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Y=g`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,X=v(`div`)`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Y} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,Z=({toast:e})=>{let{icon:t,type:n,iconTheme:r}=e;return t===void 0?n===`blank`?null:y.createElement(J,null,y.createElement(W,{...r}),n!==`loading`&&y.createElement(q,null,n===`error`?y.createElement(H,{...r}):y.createElement(ne,{...r}))):typeof t==`string`?y.createElement(X,null,t):t},re=e=>`
0% {transform: translate3d(0,${e*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,ie=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${e*-150}%,-1px) scale(.6); opacity:0;}
`,ae=`0%{opacity:0;} 100%{opacity:1;}`,oe=`0%{opacity:1;} 100%{opacity:0;}`,se=v(`div`)`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,Q=v(`div`)`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,ce=(e,t)=>{let n=e.includes(`top`)?1:-1,[r,i]=S()?[ae,oe]:[re(n),ie(n)];return{animation:t?`${g(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${g(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},le=y.memo(({toast:e,position:t,style:n,children:r})=>{let i=e.height?ce(e.position||t||`top-center`,e.visible):{opacity:0},a=y.createElement(Z,{toast:e}),o=y.createElement(Q,{...e.ariaProps},b(e.message,e));return y.createElement(se,{className:e.className,style:{...i,...n,...e.style}},typeof r==`function`?r({icon:a,message:o}):y.createElement(y.Fragment,null,a,o))});_(y.createElement);var ue=({id:e,className:t,style:n,onHeightUpdate:r,children:i})=>{let a=y.useCallback(t=>{if(t){let n=()=>{let n=t.getBoundingClientRect().height;r(e,n)};n(),new MutationObserver(n).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return y.createElement(`div`,{ref:a,className:t,style:n},i)},de=(e,t)=>{let n=e.includes(`top`),r=n?{top:0}:{bottom:0},i=e.includes(`center`)?{justifyContent:`center`}:e.includes(`right`)?{justifyContent:`flex-end`}:{};return{left:0,right:0,display:`flex`,position:`absolute`,transition:S()?void 0:`all 230ms cubic-bezier(.21,1.02,.73,1)`,transform:`translateY(${t*(n?1:-1)}px)`,...r,...i}},fe=f`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,$=16,pe=({reverseOrder:e,position:t=`top-center`,toastOptions:n,gutter:r,children:i,toasterId:a,containerStyle:o,containerClassName:s})=>{let{toasts:c,handlers:l}=R(n,a);return y.createElement(`div`,{"data-rht-toaster":a||``,style:{position:`fixed`,zIndex:9999,top:$,left:$,right:$,bottom:$,pointerEvents:`none`,...o},className:s,onMouseEnter:l.startPause,onMouseLeave:l.endPause},c.map(n=>{let a=n.position||t,o=de(a,l.calculateOffset(n,{reverseOrder:e,gutter:r,defaultPosition:t}));return y.createElement(ue,{id:n.id,key:n.id,onHeightUpdate:l.updateHeight,className:n.visible?fe:``,style:o},n.type===`custom`?b(n.message,n):i?i(n):y.createElement(le,{toast:n,position:a}))}))},me=I;export{me as n,pe as t};