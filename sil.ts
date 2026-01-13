const q1 = Promise.resolve('{"egmCountryCode":"USA","passportNo":"435053671"}')
const q2 = Promise.resolve('{"egmCountryCode":"FRA","passportNo":"1234567"}')
const q3 = Promise.resolve('{"egmCountryCode":"TWN","passportNo":"3258965"}')
;
Promise.all([q1, q2, q3]).then((values) => {
  //sonuçları işle.(tablo içerisine ekle. state de sakla.)
});
