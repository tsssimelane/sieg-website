/* Standard subject-neutral lesson plan, shared by the PDF export. */
(function(root){
 const headings=['Time (min)','Teaching Stage','Main Focus','Example Activities'];
 function draw(doc,lesson){
  const {plan:p,inputs:i}=lesson,x=18,width=174,bottom=276,cols=[21,37,44,72],step=4.4;
  let y=19;
  function font(size=9,bold=false){doc.setFont('Learn',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor('#102a43');}
  function newPage(){doc.addPage();y=19;}
  function paragraph(value,{size=10,bold=false,indent=0,gap=3}={}){
   font(size,bold);
   for(const line of doc.splitTextToSize(String(value),width-indent)){
    if(y+5>bottom)newPage();
    doc.text(line,x+indent,y+size*.34);
    y+=size*.46;
   }
   y+=gap;
  }
  function cells(lines,height,header=false,shade=false){
   let left=x;
   font(header?9.5:9,header);doc.setDrawColor('#c4d6d3');doc.setLineWidth(.18);
   lines.forEach((cell,j)=>{
    doc.setFillColor(header?'#176f73':shade?'#f2f7f4':'#ffffff');if(header)doc.setTextColor('#ffffff');
    doc.rect(left,y,cols[j],height,'FD');
    const baseline=header?y+(height-(cell.length-1)*step)/2+1.1:y+4.5;
    cell.forEach((line,n)=>doc.text(line,left+2,baseline+n*step));
    left+=cols[j];
   });
   y+=height;
  }
  function header(){
   font(9.5,true);
   cells(headings.map((label,j)=>doc.splitTextToSize(label,cols[j]-4)),14,true);
  }
  paragraph('Lesson Plan',{size:23,bold:true,gap:6});
  paragraph('Lesson '+(i.lessonNumber||'1')+'  |  Unit '+(i.unitNumber||'1')+'  |  Class: '+i.level,{bold:true,gap:3});
  if(i.unitTitle)paragraph('Unit title: '+i.unitTitle,{bold:true,gap:3});
  paragraph(i.subject+' · Topic: '+p.title+' · '+i.duration+' min',{gap:7});
  paragraph('Lesson objective(s) - by the end of the lesson students should be able to:',{bold:true});
  p.objectives.forEach((o,n)=>paragraph('• '+o,{indent:6,gap:2}));
  y+=2;
  if(y+23>bottom)newPage();
  header();
  let row=0;
  for(const stage of p.stages){
   const shade=++row%2===0;
   font();
   const lines=[String(stage.minutes),stage.title,stage.focus,stage.activity].map((value,j)=>doc.splitTextToSize(String(value),cols[j]-4));
   const count=Math.max(...lines.map(v=>v.length)),fullHeight=Math.max(9,count*step+3);
   if(y+fullHeight>bottom&&fullHeight<=bottom-31){newPage();header();}
   let at=0;
   while(at<count){
    if(y+9>bottom){newPage();header();}
    const take=Math.min(count-at,Math.floor((bottom-y-3)/step));
    cells(lines.map(v=>v.slice(at,at+take)),Math.max(9,take*step+3),false,shade);
    at+=take;
   }
  }
  y+=6;
  for(const [title,value] of [['Foreseen challenges & responses',p.foreseenChallenges],['Key language / subject terms',p.keyLanguage],['Materials, assessment & homework',p.assessment]]){
   if(!value)continue;
   if(y+15>bottom)newPage();
   if(title==='Foreseen challenges & responses'){
    font(9);
    const lines=doc.splitTextToSize(String(value),width-12);
    let at=0;
    while(at<lines.length){
     if(y+28>bottom)newPage();
     const take=Math.min(lines.length-at,Math.floor((bottom-y-20)/step)),height=17+take*step;
     doc.setFillColor('#f2f7f4');doc.setDrawColor('#d5e4de');doc.roundedRect(x,y,width,height,2,2,'FD');
     doc.setDrawColor('#218b8c');doc.setLineWidth(1);doc.line(x,y+3,x,y+height-3);doc.setLineWidth(.18);
     font(10,true);doc.setTextColor('#176f73');doc.text(title+(at?' / continued':''),x+6,y+7);
     font(9);lines.slice(at,at+take).forEach((line,n)=>doc.text(line,x+6,y+14+n*step));
     y+=height+6;at+=take;
    }
   }else{paragraph(title,{bold:true});paragraph(value);}
  }
 }
 root.SiegLessonTable={headings,draw};
})(globalThis);
