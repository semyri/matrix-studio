const BLACK = '#000000';
export const CLOCK_COLORS = Object.freeze({color:'#ffb76b',dateColor:'#9ebca4',temperatureColor:'#73cefa',timeSeparatorColor:'#edf1e6',dateSeparatorColor:'#edf1e6',degreeColor:'#edf1e6'});
const GLYPHS = {'0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110','-':'000000111000000','?':'110001010000010','L':'100100100100111','O':'010101101101010','H':'101101111101101','I':'111010010010111'};
function put(frame,x,y,color){if(x>=0&&x<16&&y>=0&&y<16)frame[y*16+x]=color;}
function text(frame,value,x,y,color){[...value].forEach((char,n)=>[...(GLYPHS[char]||GLYPHS['?'])].forEach((on,i)=>{if(on==='1')put(frame,x+n*4+i%3,y+Math.floor(i/3),color);}));}
export function timeParts(date=new Date(),hour12=true,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{...(timeZone?{timeZone}:{}),hour:'2-digit',minute:'2-digit',month:'2-digit',day:'2-digit',year:'numeric',hourCycle:hour12?'h12':'h23'}).formatToParts(date);
  return Object.fromEntries(parts.map(part=>[part.type,part.value]));
}
export function weatherType(code,isDay=1){
  if(!Number.isInteger(code))return 'unknown';
  if(code===0||code===1)return isDay===0?'moon':'sun';
  if(code===2)return isDay===0?'partly-night':'partly';if(code===3)return 'cloud';
  if(code===45||code===48)return 'fog';
  if([71,73,75,77,85,86].includes(code))return 'snow';
  if([95,96,97,99].includes(code))return 'storm';
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return 'rain';
  return 'unknown';
}
export const WEATHER_NAMES={sun:'Clear',moon:'Clear night',partly:'Partly cloudy','partly-night':'Partly cloudy night',cloud:'Overcast',fog:'Fog',snow:'Snow',storm:'Thunderstorms',rain:'Rain / drizzle',unknown:'Weather unavailable'};
export function displayTemperature(celsius,unit='F') {if(!Number.isFinite(celsius))return '--';return String(Math.round(unit==='F'?celsius*9/5+32:celsius));}
function icon(frame,type){
  const patterns={sun:['Y.Y.Y','.OOO.','YOOOY','.OOO.','Y.Y.Y'],moon:['.MMM.','MM...','MM...','MMM.M','.MMM.'],partly:['.Y...','YYY..','.YCC.','CCCCC','.SSS.'],'partly-night':['.MM..','MM...','.MCC.','CCCCC','.SSS.'],cloud:['.....','.CC..','CCCC.','CCCCC','.SSS.'],fog:['CCCCC','.....','SSSSS','.....','CCCCC'],snow:['W.W.W','.WWW.','WWIWW','.WWW.','W.W.W'],storm:['.SSS.','CCCCC','..YY.','.YY..','..Y..'],rain:['.CC..','CCCCC','.....','.R.R.','B.B..'],unknown:['.UUU.','...U.','..U..','.....','..U..']};
  const palette={Y:'#ffcd63',O:'#ffab3d',M:'#e4ebff',C:'#d5dce2',S:'#8f9da8',W:'#ffffff',I:'#b8efff',R:'#64c6ff',B:'#3b82f6',U:'#64705d'};
  patterns[type].forEach((row,y)=>[...row].forEach((token,x)=>{if(palette[token])put(frame,x,y+11,palette[token]);}));
}
export function dashboardFrame({date=new Date(),hour12=true,timeZone,layout='dashboard',color=CLOCK_COLORS.color,dateColor=CLOCK_COLORS.dateColor,temperatureColor=CLOCK_COLORS.temperatureColor,timeSeparatorColor=CLOCK_COLORS.timeSeparatorColor,dateSeparatorColor=CLOCK_COLORS.dateSeparatorColor,degreeColor=CLOCK_COLORS.degreeColor,weather=null,unit='F'}={}){
  const frame=Array(256).fill(BLACK),parts=timeParts(date,hour12,timeZone);
  if(layout==='large'){text(frame,parts.hour,4,2,color);text(frame,parts.minute,4,9,color);return frame;}
  text(frame,parts.hour,0,0,color);text(frame,parts.minute,9,0,color);put(frame,7,1,timeSeparatorColor);put(frame,7,3,timeSeparatorColor);
  text(frame,parts.month,0,6,dateColor);text(frame,parts.day,9,6,dateColor);[[8,6],[8,7],[7,8],[7,9],[7,10]].forEach(([x,y])=>put(frame,x,y,dateSeparatorColor));
  icon(frame,weatherType(weather?.code,weather?.isDay));
  let temp=displayTemperature(weather?.celsius,unit);if(temp.length>3)temp=temp.startsWith('-')?'LO':'HI';
  text(frame,temp,temp.length===3?5:7,11,Number.isFinite(weather?.celsius)?temperatureColor:'#64705d');
  if(temp.length<3&&Number.isFinite(weather?.celsius))put(frame,15,11,degreeColor);
  return frame;
}
