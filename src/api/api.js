const cheerio = require('cheerio');
const {BASE_URL} = require('./url');
const {requests , requestIframeWithAttrSandBox , getDecimalNumber , urlify} = require('../util/index');


/**
 * @param {number} page actual page, range [1 .. 1222] 
 * 
 **/
const getMovies = async(page) =>{
  const res = await requests(`${BASE_URL}/movies?page=${page}`);
  const $ = cheerio.load(res);
  const promise = [];

  $('div.videosContainer div.featuredItems').each(async(index , element) =>{
    const $element = $(element);
    const id = `${$element.find('a').attr('href')}watching.html`;
    const quality = $element.find('a span.mli-quality').text().trim();
    const title = $element.find('span.mli-info h2').text().trim();
    const poster = $element.find('img.lazy').attr('src');
    const description = $element.find('div.popcontents p.f-desc').text().trim();
    const imdb_score = getDecimalNumber($element.find('div.jtip-top div.jt-info.jt-imdb').text().trim());
    const _genres = [];

    $element.find('div.block').eq(1).find('a').each((index , el) =>{
      const $el = $(el);
      const genre = $el.attr('href').split('/')[4];
      _genres.push(genre);
    })
    
    const year = $element.find('div.jtip-top div.jt-info').eq(1).text().trim();
    const episode_length = $element.find('div.jtip-top div.jt-info').eq(2).text().trim();

    promise.push({
      id: id || null,
      title: title || null,
      poster: poster || null,
      description: description || null,
      imdb_score: imdb_score || null,
      genres: _genres || null,
      year: year || null,
      episode_length: episode_length || null,
      quality: quality || null
    });
  });

  return Promise.all(promise);
};

/**
 * @param {number} page actual page, range [1 .. 208] 
 * 
 **/
const getTVSeries = async(page) =>{
  try{
    const res = await requests(`${BASE_URL}/tvseries?page=${page}`);
    const $ = cheerio.load(res);
    const promise = [];

    const promises = $('div.videosContainer div.featuredItems').map((index, element) => new Promise(async (resolve) => {
      const $element = $(element);
      const id = $element.find('a').attr('href');
      const title = $element.find('span.mli-info h2').text().trim();
      const poster = $element.find('img.lazy').attr('src');
      const description = $element.find('div.popcontents p.f-desc').text().trim();
      const imdb_score = getDecimalNumber($element.find('div.jtip-top div.jt-info.jt-imdb').text().trim());
      const _genres = [];
      $element.find('div.block').eq(1).find('a').each((index , el) =>{
        const $el = $(el);
        const genre = $el.attr('href').split('/')[4];
        _genres.push(genre);
      })
      const year = $element.find('div.jtip-top div.jt-info').eq(1).text().trim();
      const episode_length = $element.find('div.jtip-top div.jt-info').eq(2).text().trim();

      let realID = await getRealEpisodesListURL(id);
      let episodes = await getEpisodeList(realID);

      resolve({
        //id: id || null,
        title: title || null,
        poster: poster || null,
        description: description || null,
        imdb_score: imdb_score || null,
        genres: _genres || null,
        year: year || null,
        episode_length: episode_length || null,
        episodes: episodes || null,
      })
    }));

    const data = promises.get();
    return Promise.all(data);

  }catch(err){
    console.log(err);
  }
};

const getEpisodeList = async(url) =>{
  try{
    const res = await requests(url);
    const $ = cheerio.load(res);
    
    const _episodes = []
    
    $('div.espidoes_listings div.espidoes_listings_area div.single_epsiode_row_right a').each((i , element) =>{
      const $element = $(element);  
      const url = $element.attr('href');
      _episodes.push(url)
    });
    
    const episodes = [{episodes: _episodes}];

    return Promise.all(episodes);
  }catch(err){
    console.log(err)
  }
};

const getRealEpisodesListURL = (id) =>{
  return new Promise(async(resolve , reject) =>{
    const res = await requests(id);
    const $  = cheerio.load(res);
    const url = $('div.show_banner a').attr('href');
    resolve(url)
  })
};

const getVideoURL = async(url) =>{
  try{
    const res1 = await requests(url);
    const $ = cheerio.load(res1);
    const iframeURL1 = $('iframe').attr('src');
  
    const iframeURL2 = await requestIframeWithAttrSandBox(iframeURL1);
    
    const res3 = await requests(iframeURL2);
    const $$$ = cheerio.load(res3);
    const scripts = $$$('script');

    let promise = new Promise((resolve, reject) => {
      Array.from({length: scripts.length} , async(v , k) =>{
        const $script = $(scripts[k]);
        const contents = $script.html();
        if((contents || '').includes('sources')) {
          let doc = contents.toString();
          let allPossibleUrls = await urlify(doc) || null; // This function will return all urls in the script. Now we just need to filter the url with extension *.mp4
          //The most important part!
          //We must first verify that there are possible urls in the variable allPossibleUrls, 
          //if we do not see any url the iframe is returned. Otherwise there are several possible url with extension *.mp4
          if((!Array.isArray(allPossibleUrls) || !allPossibleUrls.length)){
            resolve({
              video: iframeURL1
            });            
          }else{
            let _video = allPossibleUrls.filter(urls => urls.includes('.mp4')) || null // this returns the label (resolution type) next to the url of the video. Now we must do a split by (') to get the url
            let video = _video[0].split(',')[0].split('"')[0]; //The url of the video has a (") at the end, a split must be made
            resolve({
              video: video
            });
          }
        }
      });
    });
  
    const video = await promise;
    const data = [{data: video}]
  
    return Promise.all(data);

  }catch(err){
    console.log(err)
  }
};

module.exports = {
  getMovies,
  getTVSeries,
  getVideoURL
}