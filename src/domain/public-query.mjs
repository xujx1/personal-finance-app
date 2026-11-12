const tickerAliases={NVDA:'英伟达',BABA:'阿里',TCOM:'携程',AAPL:'苹果',MSFT:'微软',GOOGL:'谷歌',AMZN:'亚马逊',META:'Meta',TSLA:'特斯拉',VOO:'VOO',VEA:'VEA',SGOV:'SGOV',QQQ:'QQQ',SPY:'SPY',VTI:'VTI',VT:'VT',TCEHY:'腾讯'};
const places=['安徽','浙江','江苏','上海','杭州','杭州西','宣城','绩溪','泾县','查济','桃花潭','黄山','宁国','合肥','芜湖','南京','苏州','湖州','安吉','宁波','绍兴','千岛湖','莫干山','北京','天津','重庆','四川','成都','广东','广州','深圳','福建','厦门','云南','昆明','大理','丽江','海南','三亚','山东','青岛','日本','东京','大阪','京都','泰国','新加坡','香港','澳门','台湾'];
const products=['Switch','Nintendo','任天堂','塞尔达','马里奥','宝可梦','iPhone','MacBook','iPad','华为','小米','联想','索尼','PS5','Steam','戴森','乐高','游戏卡','卡带','手机','电脑','显示器','2K','4K','电视','相机','汽车','奶粉','纸尿裤'];
export function publicResearchQuery(input){
 if(typeof input.searchQuery==='string'&&input.searchQuery.trim())return input.searchQuery.trim().slice(0,300);
 const q=String(input.question??'');
 if(input.kind==='wealth'){
  const tickers=new Set();for(const [ticker,alias]of Object.entries(tickerAliases))if(new RegExp('\\b'+ticker+'\\b','i').test(q)||alias!==ticker&&q.includes(alias))tickers.add(ticker);
  for(const ticker of input.allowedSymbols??[])if(/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)&&q.toUpperCase().includes(ticker))tickers.add(ticker);
  return ([...tickers].slice(0,8).join(' ')||'ETF asset allocation')+' latest quote earnings risk';
 }
 if(input.kind==='travel'){const locations=places.filter(p=>q.includes(p)).slice(0,6).join(' ');return (locations||'周末旅行')+' 高铁 自驾 亲子酒店 餐饮 '+(/^\d{4}-\d{2}-\d{2}$/.test(input.date??'')?input.date:'')}
 if(input.kind==='shopping'){
  let link='';for(const raw of q.match(/https:\/\/[^\s<>，。]+/g)??[]){try{const u=new URL(raw);if(!u.username&&!u.password&&/(^|\.)(jd\.com|taobao\.com|tmall\.com|amazon\.[a-z.]+|nintendo\.com|sony\.com)$/.test(u.hostname)&&!/(order|cart|login|account|address)/i.test(u.pathname)){const clean=new URL(u.origin+u.pathname);for(const key of ['id','sku','itemId','goods_id','pid']){const value=u.searchParams.get(key);if(value&&/^\d{1,24}$/.test(value))clean.searchParams.set(key,value)}link=clean.href;break}}catch{}}
  const names=products.filter(p=>q.toLowerCase().includes(p.toLowerCase())).slice(0,6).join(' ');return ((link+' '+names).trim()||'商品')+' 同款 规格 到手价 运费 比价';
 }
 return '餐饮 菜单 食材 采购 价格参考';
}
