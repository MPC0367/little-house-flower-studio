// A bounded, documented concept corpus. These are design starting points, not shop inventory.
const base={palette:'florist',flowers:[],ribbon:'cream',size:'reference',sourceProduct:null,unchanged:false};
export const recipes=[
 {id:'florist-bouquet',title:{th:'ให้ร้านจัดโทนอ่อน',en:'A soft florist’s choice'},description:{th:'ภาพแนวทางโทนชมพูขาว ร้านเลือกชนิดดอกไม้',en:'A representative pink and white mix; the florist selects the flowers.'},config:{...base,style:'bouquet',container:'paper',finish:'cream'}},
 {id:'red-roses-cream',title:{th:'กุหลาบแดง ห่อครีม',en:'Red roses, cream wrap'},config:{...base,style:'bouquet',container:'paper',finish:'cream',palette:'red',flowers:['rose_red','eucalyptus']}},
 {id:'blue-white-box',title:{th:'กล่องฟ้าขาว',en:'Blue & white flower box'},config:{...base,style:'box',container:'hatbox',finish:'blue',palette:'blue-white',flowers:['hydrangea','rose_white','eucalyptus']}},
 {id:'white-green-basket',title:{th:'กระเช้าขาวเขียว',en:'White & green basket'},config:{...base,style:'basket',container:'wicker',finish:'natural',palette:'white-green',flowers:['rose_white','babys_breath','eucalyptus']}},
 {id:'bridal-white',title:{th:'ช่อเจ้าสาวสีขาว',en:'White bridal bouquet'},config:{...base,style:'wedding',container:'hand-tied',finish:'cream',palette:'white-green',flowers:['rose_white','lisianthus','eucalyptus']}},
 {id:'jasmine-garland',title:{th:'พวงมาลัยมะลิ',en:'Jasmine garland'},config:{...base,style:'garland',container:'garland-thread',finish:'white',palette:'white-green',flowers:['jasmine']}},
 {id:'pastel-wreath',title:{th:'พวงหรีดชมพูขาว',en:'Pastel sympathy wreath'},config:{...base,style:'wreath',container:'wreath-frame',finish:'natural',palette:'pink-white',flowers:['rose_pink','carnation','pompon']}},
 {id:'money-rose',title:{th:'ช่อธนบัตรและกุหลาบ',en:'Rose money bouquet'},description:{th:'ธนบัตรในภาพเป็นตัวแทน ไม่ระบุมูลค่า ค่าจัดแยกต่างหาก',en:'Illustrative folded notes, no denomination. Face value is separate from arrangement fees.'},config:{...base,style:'money',container:'paper',finish:'cream',palette:'red',flowers:['rose_red','eucalyptus'],ribbon:'burgundy'}}
];
export const defaultRecipe=style=>recipes.find(r=>r.config.style===style)||recipes[0];
