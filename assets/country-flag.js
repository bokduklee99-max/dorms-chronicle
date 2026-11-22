const flags = {
 actor_usa:'us.svg', actor_ussr:'ussr.webp', actor_prc:'cn.svg', actor_roc:'tw.svg',
 actor_kor:'kr.svg', actor_prk:'kp.svg', actor_uk:'gb.svg', actor_france:'fr.svg',
 actor_frg:'de.svg', actor_gdr:'gdr.webp', actor_japan:'jp.svg', actor_cuba:'cu.svg',
 actor_south_vietnam:'south-vietnam.svg'
};
const regionCodes = {
 USA:'US',KOR:'KR',PRK:'KP',CHN:'CN',CUB:'CU',JPN:'JP',GBR:'GB',FRA:'FR',GRC:'GR',TUR:'TR',
 HUN:'HU',POL:'PL',BGR:'BG',ROU:'RO',ALB:'AL',CAN:'CA',BEL:'BE',DNK:'DK',ISL:'IS',ITA:'IT',
 LUX:'LU',NLD:'NL',NOR:'NO',PRT:'PT',AUT:'AT',CYP:'CY',FIN:'FI',VAT:'VA',IRL:'IE',LIE:'LI',
 MLT:'MT',MCO:'MC',SMR:'SM',ESP:'ES',SWE:'SE',CHE:'CH',VNM:'VN',ISR:'IL',EGY:'EG',JOR:'JO',
 SYR:'SY',IND:'IN',PAK:'PK',BGD:'BD',AFG:'AF',IRN:'IR',KHM:'KH',RUS:'RU',UKR:'UA',BLR:'BY',
 GEO:'GE',LVA:'LV',LTU:'LT',EST:'EE'
};

export function countryFlag(country,date){
 const id=country.actor_id;
 let file=flags[id];
 if((id==='joseon'||id==='empire')&&date>='1882'&&date<'1911')file='korea-1882.svg';
 if((id==='japan'||id==='actor_japan')&&date>='1870'&&date<'1999-08-13')file='japan-1870.svg';
 if(id==='actor_gdr'&&date<'1959-10')file='de.svg';
 if(id==='actor_yugoslavia'&&date>='1946-02'&&date<'1992-04-28')file='yugoslavia.svg';
 if(id==='actor_north_vietnam'&&date>='1955-12'&&date<'1976-07-03')file='north-vietnam.svg';
 if(id==='actor_german_reich'&&date>='1935-09-15'&&date<='1945-05-08')file='german-reich.svg';
 if(file)return {src:'/assets/flags/'+file};
 const region=id==='actor_czechoslovakia'&&date>='1920-03-30'?'CZ':regionCodes[country.iso3];
 if(region)return {symbol:String.fromCodePoint(...Array.from(region,c=>0x1F1E6+c.charCodeAt(0)-65))};
}
