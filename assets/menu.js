(function(){
'use strict';
const KEY='recipes-weekly-menu-v1';
const recipes=window.RECIPES_DATA;
const db=window.RECIPES_INGREDIENTS;
const ui=window.RECIPES_UI;
const $=id=>document.getElementById(id);
const mealNames=['завтрак','обед','ужин'];
const labels=['веганское','вегетарианское','диетическая','диабетическая','безглютеновая','бессолевая','низкоуглеводная'];
let plan=[];
const params=new URLSearchParams(location.search);
let pending=recipes.find(r=>r.id===Number(params.get('add')));
const find=id=>recipes.find(r=>r.id===Number(id));
const fmt=n=>Number(n.toFixed(1)).toLocaleString('ru-RU');
const persons=()=>Math.min(20,Math.max(1,Number($('people').value)||1));
const chosen=()=>[...document.querySelectorAll('#diets input:checked')].map(x=>x.value);
function message(text){$('menuStatus').textContent=text;}
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function emptyWeek(){const start=new Date($('start').value+'T12:00:00');return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return {date:d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}),items:[]};});}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({plan,people:persons(),start:$('start').value,meals:$('meals').value,exclude:$('exclude').value,diets:chosen()}));return true;}catch(e){message('Не удалось сохранить меню в браузере. Оставьте страницу открытой и сохраните покупки в CSV.');return false;}}
function restore(){try{const v=JSON.parse(localStorage.getItem(KEY));if(!v||!Array.isArray(v.plan)||v.plan.length!==7)return false;
plan=v.plan.map(day=>({date:String(day.date),items:(Array.isArray(day.items)?day.items:[]).filter(it=>find(it.id)).map(it=>({id:Number(it.id),meal:mealNames.includes(it.meal)?it.meal:'обед',options:[...new Set([...(Array.isArray(it.options)?it.options:[]).map(Number).filter(id=>find(id)),Number(it.id)])]}))}));
$('people').value=Math.min(20,Math.max(1,Number(v.people)||1));if(/^\d{4}-\d{2}-\d{2}$/.test(v.start||''))$('start').value=v.start;if(['2','3'].includes(v.meals))$('meals').value=v.meals;$('exclude').value=typeof v.exclude==='string'?v.exclude:'';
document.querySelectorAll('#diets input').forEach(x=>x.checked=(v.diets||[]).includes(x.value));return true;}catch(e){return false;}}
function matches(r,ds){return ds.every(d=>d==='веганское'?r.diet===d:d==='вегетарианское'?['веганское','вегетарианское'].includes(r.diet):d==='диетическая'?(r.tags.includes(d)||r.cal==='низкая'):r.tags.includes(d));}
function allowed(r){const ex=$('exclude').value.toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);return matches(r,chosen())&&!ex.some(x=>(r.name+' '+r.ingredients+' '+r.formula).toLowerCase().includes(x));}
function advice(){const ds=chosen();$('advice').textContent=ds.length?'Выбраны ограничения: '+ds.join(', ')+'. Они применяются при автоматическом подборе и ручном добавлении. Метки не заменяют индивидуальный подбор питания.':'Без специальных ограничений. Можно создать меню автоматически или наполнить его кнопкой «Выбор» в каталоге.';}
function create(){if(!$('start').value)return message('Укажите дату начала недели.');const meals=$('meals').value==='2'?mealNames.slice(1):mealNames;
const pools=Object.fromEntries(meals.map(m=>[m,recipes.filter(r=>r.ingredientsStructured&&r.meal.includes(m)&&allowed(r))]));
const missing=meals.filter(m=>!pools[m].length);if(missing.length)return message('Недостаточно подходящих блюд для: '+missing.join(', ')+'. Измените ограничения. Текущее меню сохранено.');
if(plan.some(d=>d.items.length)&&!confirm('Создать новое меню вместо текущего? Выбранные ранее блюда будут заменены.'))return;
plan=emptyWeek();plan.forEach((day,d)=>day.items=meals.map((m,k)=>({meal:m,id:pools[m][(d+k)%pools[m].length].id,options:pools[m].map(r=>r.id)})));render();persist();message('Меню создано; список закупок пересчитан.');}
function shoppingRows(){const totals=new Map(),notes=new Set();for(const day of plan)for(const it of day.items){const r=find(it.id);if(!r.ingredientsStructured){notes.add(r.name+': нет точной граммовки — добавьте продукты вручную по рецепту.');continue;}
for(const item of r.ingredientsStructured){if(item.ingredientId==='water')continue;const ref=db[item.ingredientId];if(!ref){notes.add(r.name+': неизвестный ингредиент');continue;}const key=item.ingredientId+'|'+item.unit;const row=totals.get(key)||{name:ref.name,unit:item.unit,qty:0};row.qty+=item.amount*persons()/r.yieldServings;totals.set(key,row);}}
return {rows:[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')),notes:[...notes]};}
function shoppingText(){const {rows,notes}=shoppingRows();return 'Список закупок на 7 дней\n'+rows.map(v=>v.name+': '+fmt(v.qty)+' '+v.unit).join('\n')+(notes.length?'\n\nУточнить вручную:\n'+notes.join('\n'):'');}
function renderShopping(){const {rows,notes}=shoppingRows();$('shoppingContent').innerHTML=rows.length?'<p>Позиций: '+rows.length+'</p><div class="grid">'+rows.map(v=>'<label><input type="checkbox"> '+ui.esc(v.name)+' — <b>'+fmt(v.qty)+' '+ui.esc(v.unit)+'</b></label>').join('')+'</div>':'<p>Добавьте блюда в меню.</p>';
if(notes.length)$('shoppingContent').innerHTML+='<div class="warn"><b>Уточнить вручную:</b><ul>'+notes.map(n=>'<li>'+ui.esc(n)+'</li>').join('')+'</ul></div>';}
function render(){advice();$('result').innerHTML=plan.length?'<h2>Меню на 7 дней · '+persons()+' чел.</h2>'+plan.map((day,d)=>'<article class="day"><h3>'+ui.esc(day.date)+'</h3>'+(day.items.length?day.items.map((it,i)=>{const r=find(it.id);return '<div class="meal"><label>'+ui.esc(it.meal)+': <select aria-label="Блюдо: '+ui.esc(it.meal)+'" data-day="'+d+'" data-item="'+i+'">'+it.options.map(id=>{const x=find(id);return '<option value="'+id+'" '+(id===it.id?'selected':'')+'>'+ui.esc(x.name)+'</option>';}).join('')+'</select></label><p><a href="../recipe/?id='+r.id+'">Открыть рецепт</a> <button type="button" class="secondary noprint" data-remove-day="'+d+'" data-remove-item="'+i+'">Убрать</button></p><details><summary>Ингредиенты и приготовление</summary><p>'+ui.esc(r.formula)+'</p></details></div>';}).join(''):'<p class="muted">Блюда ещё не выбраны.</p>')+'</article>').join(''):'<p>Выберите блюда в каталоге или создайте меню автоматически.</p>';
document.querySelectorAll('[data-day]').forEach(el=>el.onchange=()=>{const r=find(el.value);if(!r||!allowed(r)){message('Блюдо не соответствует текущим ограничениям.');render();return;}plan[Number(el.dataset.day)].items[Number(el.dataset.item)].id=r.id;render();persist();});
document.querySelectorAll('[data-remove-day]').forEach(el=>el.onclick=()=>{plan[Number(el.dataset.removeDay)].items.splice(Number(el.dataset.removeItem),1);render();persist();message('Блюдо и его ингредиенты удалены из меню и закупок.');});renderShopping();renderPicker();}
function renderPicker(){if(!pending)return;$('selectionPanel').hidden=false;$('selectedName').textContent=pending.name;
const old=$('selectionDay').value;const days=plan.length?plan:emptyWeek();$('selectionDay').innerHTML=days.map((day,i)=>'<option value="'+i+'">'+ui.esc(day.date)+'</option>').join('');if(old)$('selectionDay').value=old;
$('selectionNote').textContent=pending.ingredientsStructured?'Будет добавлено по одной порции на каждого человека. Одинаковые продукты суммируются в списке закупок. Другие блюда останутся в меню.':'У этого рецепта нет точной граммовки. Он появится в меню, а в закупках будет напоминание добавить продукты вручную.';}
function addSelected(){if(!pending)return;if(!allowed(pending))return message('Блюдо не соответствует выбранным ограничениям или содержит исключённые продукты. Измените настройки перед добавлением.');if(!$('start').value)return message('Укажите дату начала недели.');if(!plan.length)plan=emptyWeek();const d=Number($('selectionDay').value),meal=$('selectionMeal').value;if(!Number.isInteger(d)||d<0||d>6||!mealNames.includes(meal))return;
plan[d].items.push({id:pending.id,meal,options:[pending.id]});plan[d].items.sort((a,b)=>mealNames.indexOf(a.meal)-mealNames.indexOf(b.meal));render();const saved=persist();if(saved)message('Добавлено: '+pending.name+' — '+plan[d].date+', '+meal+'. Ингредиенты включены в закупки.');
const url=new URL(location.href);url.searchParams.delete('add');history.replaceState(null,'',url);pending=null;$('selectionPanel').hidden=true;}
function plain(){return plan.map(d=>d.date+'\n'+d.items.map(it=>it.meal+': '+find(it.id).name).join('\n')).join('\n\n');}
function copy(text){navigator.clipboard.writeText(text).then(()=>message('Скопировано.')).catch(()=>message('Не удалось скопировать. Используйте CSV или печать.'));}
$('diets').innerHTML=labels.map(x=>'<label><input type="checkbox" value="'+x+'"> '+x+'</label>').join('');$('start').value=today();
$('generate').onclick=create;$('restore').onclick=()=>{if(restore()){render();message('Сохранённое меню загружено.');}else message('Сохранённое меню не найдено.');};
$('save').onclick=()=>{if(!plan.length)return message('Сначала добавьте блюда.');if(persist())message('Меню сохранено на этом устройстве.');};
$('print').onclick=()=>window.print();$('copy').onclick=()=>copy(plain());$('copyShopping').onclick=()=>copy(shoppingText());
$('people').addEventListener('input',()=>{render();if(plan.length)persist();});
$('start').addEventListener('change',()=>{if(plan.length&&$('start').value){const days=emptyWeek();plan.forEach((d,i)=>d.date=days[i].date);render();persist();}else renderPicker();});
$('downloadShopping').onclick=()=>{const {rows,notes}=shoppingRows();if(!rows.length&&!notes.length)return message('Список закупок пуст.');const cell=x=>'"'+String(x).replace(/"/g,'""')+'"';let csv='Продукт;Количество;Единица\r\n'+rows.map(v=>[v.name,String(Number(v.qty.toFixed(1))).replace('.',','),v.unit].map(cell).join(';')).join('\r\n');if(notes.length)csv+='\r\n'+notes.map(n=>[n,'',''].map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='zakupki-na-7-dney.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('addSelected').onclick=addSelected;
restore();$('selectionMeal').innerHTML=mealNames.map(m=>'<option>'+m+'</option>').join('');if(pending)$('selectionMeal').value=pending.meal[0]||'обед';render();if(params.has('add')&&!pending)message('Выбранный рецепт не найден.');
})();
