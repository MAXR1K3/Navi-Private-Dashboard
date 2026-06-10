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

/* ===== modals ===== */
function openOverlay(id){ $("#"+id).classList.add("open"); }
function closeOverlay(id){ $("#"+id).classList.remove("open"); }
function closeAll(){ ["bmOverlay","promptOverlay","confirmOverlay","importOverlay","settingsOverlay","trashOverlay","suggestOverlay"].forEach(closeOverlay); confirmCb=null; promptCb=null; }
document.addEventListener("click", function(e){ if(e.target.closest("[data-close]")){ closeAll(); return; } if(e.target.classList&&e.target.classList.contains("overlay")&&_pressEl===e.target){ e.target.classList.remove("open"); } });
document.addEventListener("keydown", function(e){ if(e.key==="Escape"){ closeAll(); closeMenu(); } });

var confirmCb=null;
function openConfirm(title,msg,okLabel,cb){ $("#confirmTitle").textContent=title; var msgEl=$("#confirmMsg"); msgEl.style.whiteSpace=""; msgEl.textContent=msg; $("#confirmOk").textContent=okLabel||t("delete"); confirmCb=cb; openOverlay("confirmOverlay"); }
$("#confirmOk").addEventListener("click", function(){ closeOverlay("confirmOverlay"); if(confirmCb){ confirmCb(); confirmCb=null; } });
var promptCb=null;
function openPrompt(title,value,cb){ $("#promptTitle").textContent=title; var inp=$("#promptInput"); inp.value=value||""; promptCb=cb; openOverlay("promptOverlay"); setTimeout(function(){ inp.focus(); inp.select(); },50); }
function submitPrompt(){ var v=$("#promptInput").value.trim(); closeOverlay("promptOverlay"); if(promptCb){ promptCb(v); promptCb=null; } }
$("#promptSave").addEventListener("click", submitPrompt);
$("#promptInput").addEventListener("keydown", function(e){ if(e.key==="Enter") submitPrompt(); });
