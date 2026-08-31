/* ui-core.js — Toast 通知与模态框基础设施 */
"use strict";

/* ===== toasts ===== */
function toast(msg,type){ var el=document.createElement("div"); el.className="toast "+(type||""); el.innerHTML=(type==="ok"?ICONS.ok:(type==="err"?ICONS.x:ICONS.info))+"<span>"+escapeHtml(msg)+"</span>"; $("#toasts").appendChild(el); requestAnimationFrame(function(){ el.classList.add("show"); }); setTimeout(function(){ el.classList.remove("show"); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },350); },2800); }

// 带“撤销”按钮的 toast：删除/批量删除/移动分类等操作后给出短时撤销入口
function toastUndo(msg, undoFn){
  var el=document.createElement("div"); el.className="toast";
  el.innerHTML=ICONS.info+"<span>"+escapeHtml(msg)+"</span>"+
    '<button class="undo-btn" type="button">'+escapeHtml(t("undo"))+"</button>";
  $("#toasts").appendChild(el);
  requestAnimationFrame(function(){ el.classList.add("show"); });
  var gone=false;
  function dismiss(){ if(gone) return; gone=true; el.classList.remove("show"); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },350); }
  el.querySelector(".undo-btn").addEventListener("click", function(){
    dismiss();
    if(undoFn){ undoFn(); toast(t("undone"),"ok"); }
  });
  setTimeout(dismiss, 6500);
}

/* ===== modals =====
   焦点管理：打开时记住来源焦点并把焦点移进弹窗，Tab 在弹窗内循环，关闭后焦点归位。
   命令面板（palette-overlay）自己管理生命周期与焦点，这里一律跳过。 */
var _ovFocus={};
function overlayIds(){
  return $all(".overlay").filter(function(el){ return el.id && !el.classList.contains("palette-overlay"); })
    .map(function(el){ return el.id; });
}
function overlayIsStatic(el){ return !!(el&&el.hasAttribute("data-static-overlay")); }
function activeOpenOverlay(){
  var focused=document.activeElement&&document.activeElement.closest
    ?document.activeElement.closest(".overlay.open"):null;
  if(focused&&!focused.classList.contains("palette-overlay")) return focused;
  return $all(".overlay.open").filter(function(el){ return !el.classList.contains("palette-overlay"); }).pop()||null;
}
function focusablesIn(el){
  return $all('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', el)
    .filter(function(n){ return n.offsetWidth||n.offsetHeight||n.getClientRects().length; });
}
function openOverlay(id){
  var el=$("#"+id); if(!el) return;
  if(!el.classList.contains("open")) _ovFocus[id]=document.activeElement;
  el.classList.add("open");
  var modal=el.querySelector(".modal");
  if(modal){
    if(!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex","-1");
    setTimeout(function(){ if(el.classList.contains("open")&&!el.contains(document.activeElement)) modal.focus(); },20);
  }
}
function closeOverlay(id){
  var el=$("#"+id); if(!el) return;
  var was=el.classList.contains("open");
  el.classList.remove("open");
  if(was){
    var prev=_ovFocus[id]; _ovFocus[id]=null;
    // 焦点归位：元素仍在文档里才还回去，否则会把焦点丢给 body
    if(prev&&prev.focus&&document.contains(prev)) setTimeout(function(){ try{ prev.focus(); }catch(e){} },0);
  }
}
function closeAll(){
  var ids=overlayIds().filter(function(id){ return !overlayIsStatic($("#"+id)); });
  if(typeof summaryUi!=="undefined"&&summaryUi.running) ids=ids.filter(function(id){ return id!=="summaryOverlay"; });
  ids.forEach(closeOverlay); confirmCb=null; promptCb=null;
}
// Tab 焦点陷阱：弹窗打开时不让焦点跑到背后的页面
document.addEventListener("keydown", function(e){
  if(e.key!=="Tab") return;
  var open=activeOpenOverlay();
  if(!open) return;
  var f=focusablesIn(open); if(!f.length) return;
  var first=f[0], last=f[f.length-1];
  if(e.shiftKey && (document.activeElement===first || !open.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
document.addEventListener("click", function(e){
  var close=e.target.closest("[data-close]");
  if(close){
    var owner=close.closest(".overlay");
    if(owner&&overlayIsStatic(owner)) return;
    closeAll(); return;
  }
  if(e.target.classList&&e.target.classList.contains("overlay")&&_pressEl===e.target){
    if(overlayIsStatic(e.target)) return;
    if(e.target.id==="summaryOverlay"&&typeof summaryUi!=="undefined"&&summaryUi.running) return;
    closeOverlay(e.target.id);
  }
});
document.addEventListener("keydown",function(e){
  if(e.key!=="Escape") return;
  var active=activeOpenOverlay();
  if(active&&!overlayIsStatic(active)){
    closeOverlay(active.id); confirmCb=null; promptCb=null; closeMenu(); return;
  }
  if(document.querySelector(".overlay.open[data-static-overlay]")) return;
  closeAll(); closeMenu();
});

var confirmCb=null;
function openConfirm(title,msg,okLabel,cb){ $("#confirmTitle").textContent=title; var msgEl=$("#confirmMsg"); msgEl.style.whiteSpace=""; msgEl.textContent=msg; $("#confirmOk").textContent=okLabel||t("delete"); confirmCb=cb; openOverlay("confirmOverlay"); }
$("#confirmOk").addEventListener("click", function(){ closeOverlay("confirmOverlay"); if(confirmCb){ confirmCb(); confirmCb=null; } });
var promptCb=null;
function openPrompt(title,value,cb,opts){
  opts=opts||{};
  $("#promptTitle").textContent=title;
  var inp=$("#promptInput"); inp.value=value||"";
  var pinRow=$("#promptPinRow");
  if(pinRow){
    pinRow.style.display=opts.pin?"":"none";
    $("#promptPin").checked=!!opts.pinChecked;
    $("#promptPinTitle").textContent=opts.pinTitle||"";
    $("#promptPinDesc").textContent=opts.pinDesc||"";
  }
  var colorRow=$("#promptColorRow");
  if(colorRow){
    var color=opts.colorValue||"";
    colorRow.style.display=opts.color?"":"none";
    colorRow.setAttribute("data-enabled", color?"1":"0");
    $("#promptColor").value=color||"#6d5efc";
    $("#promptColorTitle").textContent=opts.colorTitle||"";
    $("#promptColorDesc").textContent=opts.colorDesc||"";
  }
  promptCb=cb; openOverlay("promptOverlay"); setTimeout(function(){ inp.focus(); inp.select(); },50);
}
function submitPrompt(){
  var v=$("#promptInput").value.trim(), pin=$("#promptPin"), colorRow=$("#promptColorRow"), color="";
  if(colorRow&&colorRow.style.display!=="none"&&colorRow.getAttribute("data-enabled")==="1") color=$("#promptColor").value||"";
  closeOverlay("promptOverlay"); if(promptCb){ promptCb(v, pin&&pin.checked, color); promptCb=null; }
}
$("#promptSave").addEventListener("click", submitPrompt);
$("#promptInput").addEventListener("keydown", function(e){ if(e.key==="Enter") submitPrompt(); });
$("#promptColor").addEventListener("input", function(){ var row=$("#promptColorRow"); if(row) row.setAttribute("data-enabled","1"); });
$("#promptColorReset").addEventListener("click", function(){ var row=$("#promptColorRow"); if(row) row.setAttribute("data-enabled","0"); $("#promptColor").value="#6d5efc"; });
