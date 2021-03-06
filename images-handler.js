/**
 * What this script do?
 * it looks up every folders in BASE_TEMP with this format: <article_no>/<color_code>/<Images[]>
 * and copy them all both in BASE_DEST (<product_id>/<product_instance_id>/<Images[]>) and in db
 * 
 * the first image of each folder is counted as thumbnail and is prefixed by THUMBNAIL_PREFIX
 * and is resized to scale in 144x144 image, and is also added in main images of that product
 * 
 * finally it produces a report showing that which articles were joint, which weren't in db,
 * which color codes were in db but not here, and which color codes were here but not in db.
 */

const db = require('./mongo/index');
const models = require('./mongo/models.mongo');
// const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const Jimp = require("jimp");
const jsonexport = require('jsonexport');
const dateTime = require('node-datetime');
const BASE_TEMP = './public/images/temp';
const BASE_DEST = './public/images/product-image';
const REPORT_PATH = './public/report';
const THUMBNAIL_PREFIX = "thmbnl_";
const rimraf = require('rimraf');
const fs = require('fs-extra');

let products;

let dbInfo = [];
let dirInfo = [];

main = async () => {

  try {
    await db.dbIsReady();
  }
  catch (err) {
    process.exit();
  }

  await modelIsReady();


  try {

    const dirArticles = getDirInfo(BASE_TEMP).dirs;

    console.log('-> ', ` ${dirArticles.length} articles exists in dir`);

    if (dirArticles && dirArticles.length) {
      dirArticles.forEach(article => {

        const newArticleInfo = {
          article,
          codes: []
        };

        dirInfo.push(newArticleInfo);

        const dirArticleCodes = getDirInfo(path.join(BASE_TEMP, article)).dirs;

        if (dirArticleCodes && dirArticleCodes.length) {
          dirArticleCodes.forEach(code => {

            const newCodeInfo = {
              no: code,
              images: [],
            }
            newArticleInfo.codes.push(newCodeInfo);
            let images = getDirInfo(path.join(BASE_TEMP, article, code)).files;

            if (images && images.length) {
              images.forEach(image => {
                const parts = image.split('.');
                if (parts && parts.length > 1 && ['png', 'jpg', 'jpeg', 'tiff', 'gif', 'webp'].some(x => parts[1].toLowerCase() === x)) {
                  newCodeInfo.images.push(image);
                }
              })

            }

          });
        }
      })

      if (dirInfo && dirInfo.length) {
        products = await getProducts(dirArticles);

        console.log('-> ', ` ${products.length} related product exists in database`);

        if (products && products.length) {
          for (let i = 0; i < products.length; i++) {
            const product = products[i];

            let newDBArticleInfo = {
              no: product.article_no,
              codes: []
            };
            dbInfo.push(newDBArticleInfo);
            foundDir = dirInfo.find(info => product.article_no.includes(info.article));

            if (foundDir) {

              try {
                if (!fs.existsSync(path.join(BASE_DEST, product._id.toString()))) {
                  fs.mkdirSync(path.join(BASE_DEST, product._id.toString()));
                }

                for (let j = 0; j < product.colors.length; j++) {
                  const color = product.colors[j];

                  newDBArticleInfo.codes.push(color.code);
                  foundDirCode = foundDir.codes.find(code => code.no === color.code);
                  if (foundDirCode) {
                    try {

                      if (!fs.existsSync(path.join(BASE_DEST, product._id.toString(), color._id.toString()))) {
                        fs.mkdirSync(path.join(BASE_DEST, product._id.toString(), color._id.toString()));
                      }

                      for (let k = 0; k < foundDirCode.images.length; k++) {
                        let image = foundDirCode.images[k];
                        const imageOrig = path.join(BASE_TEMP, foundDir.article, foundDirCode.no, image);
                        let imageDest = path.join(BASE_DEST, product._id.toString(), color._id.toString(), image);

                        try {
                          // add to angles
                          await fs.copy(imageOrig, imageDest)
                          await updateProductImages(product._id, color._id, image, false);

                          // check if it was thumbnail, add to thumbnail and also resize the image
                          if (k === 0) {
                            image = THUMBNAIL_PREFIX + image;
                            imageDest = path.join(BASE_DEST, product._id.toString(), color._id.toString(), image);
                            await imageResizing(imageOrig, imageDest);
                            await updateProductImages(product._id, color._id, image, true);
                          }
                          console.log('-> ', `${image} is succesfuly added to path: ${path.join(product._id.toString(), color._id.toString())} ${k === 0 ? 'as thumbnail' : ''} `);
                        } catch (err) {
                          console.log('-> ', `error on copying file ${image} from temp folder to destination ${k === 0 ? 'as thumbnail' : ''} => ${err}`);
                        }

                      }
                    }
                    catch (err) {
                      console.log('-> error on making new folder with color id as name', err);
                    }
                  }
                }

              } catch (err) {
                console.log('-> error in making new folder with product id as name', err);
              }
            }
          }
          makeReport();
        } else {
          console.log('-> ', 'there is no new product to import images for');

        }

      } else {
        console.log('-> ', 'there is no parsed info in temp folder');
      }

    } else {
      console.log('-> ', 'there is no info in temp folder');
    }

    process.exit();

  } catch (e) {
    console.log('-> ', e);
    process.exit();
  }
}


getDirInfo = (_path) => {
  try {
    const items = fs.readdirSync(_path);
    const result = {
      dirs: [],
      files: []
    };
    if (items && items.length) {
      items.forEach(item => {
        const itemPath = path.join(_path, item);
        try {
          if (fs.lstatSync(itemPath).isDirectory()) {
            result.dirs.push(item)
          } else {

            const stats = fs.statSync(path.join(_path, item));
            const size = stats["size"]
            result.files.push({name: item, size})
          };
        } catch (err) {
          console.log('-> ', err);
        }
      })

      if (result.files && result.files.length) {
        result.files = result.files.filter((obj, pos, arr) => {
          return arr.map(mapObj => mapObj.size).indexOf(obj.size) === pos;
        }).map(x => x.name);
      }
    }
    return result;
  }
  catch (error) {
    console.log('-> ', error);
    return null;
  }



}


makeReport = () => {

  const result = [];
  const dirArticles = new Set(dirInfo.map(x => x.article));
  const dbArticles = new Set(dbInfo.map(x => x.no));

  let intersecArticles = new Set(
    [...dirArticles].filter(x => dbArticles.has(x)));


  intersecArticles.forEach(articleNo => {

    let newJointArticle = {article: articleNo, status: 'joint', codes: []};
    result.push(newJointArticle);

    const dirArticleCodes = new Set(dirInfo.find(x => x.article === articleNo).codes.map(x => x.no));
    const dbArticleCodes = new Set(dbInfo.find(x => x.no === articleNo).codes);

    let intersectCodes = new Set(
      [...dirArticleCodes].filter(x => dbArticleCodes.has(x)));

    intersectCodes.forEach(code => {
      newJointArticle.codes.push({code, status: 'joint'})
    })

    let dirCodesDiff = new Set( // dir codes - db codes
      [...dirArticleCodes].filter(x => !dbArticleCodes.has(x)));

    let dbCodesDiff = new Set( // db codes - dir codes
      [...dbArticleCodes].filter(x => !dirArticleCodes.has(x)));

    dirCodesDiff.forEach(code => {
      newJointArticle.codes.push({code, status: 'only in DIR'})
    })

    dbCodesDiff.forEach(code => {
      newJointArticle.codes.push({code, status: 'only in DB'})
    })
  });

  let dirArticlesDiff = new Set( // dir articles - db articles
    [...dirArticles].filter(x => !dbArticles.has(x)));

  let dbArticlesDiff = new Set( // db articles - dir articles
    [...dbArticles].filter(x => !dirArticles.has(x)));

  dirArticlesDiff.forEach(article => {
    result.push({article, status: 'only in DIR'})
  })

  dbArticlesDiff.forEach(article => {
    result.push({article, status: 'only in DB'})
  })


  jsonexport(result, function (err, csv) {
    if (err) return console.log(err);

    if (!fs.existsSync(REPORT_PATH)) {
      fs.mkdirSync(REPORT_PATH);
    }

    const dt = dateTime.create();
    const formatted = dt.format('Y-m-d');
    fs.writeFileSync(path.join(REPORT_PATH, `image-import-report-${formatted}.csv`), csv, 'utf8');

    console.log('-> ', 'report is generated !!!');

  });

  rimraf(BASE_TEMP, function () {
    console.log('-> ', 'temp folder removed succesfully !!!');
  });

}

updateProductImages = async (productId, colorId, image, isThumbnail) => {
  try {

    const query = {
      _id: mongoose.Types.ObjectId(productId),
      'colors._id': mongoose.Types.ObjectId(colorId),
    };

    if (isThumbnail) {
      return models()['Product'].update(query, {
        $set: {
          'colors.$.image.thumbnail': image,
          'colors.$.images_imported': true
        }
      }, {multi: true});
    } else {
      return models()['Product'].update(query, {
        $addToSet: {
          'colors.$.image.angles': image
        }

      });
    }

  }
  catch (err) {
    console.log('-> could not update product', err);
  }
}

getProducts = async (articles) => {
  try {

    return models()['Product'].find({
      article_no: {
        $in: articles
      }
    }, {
        article_no: 1,
        colors: 1
      })
  } catch (err) {
    console.log('-> could not get products', err);
  }
}


imageResizing = async (orig, dest) => {
  const lenna = await Jimp.read(orig);
  return lenna
    .scaleToFit(220, 220)
    .write(dest);
}

modelIsReady = async () => {
  return new Promise((resolve, reject) => {

    getModels = () => {

      setTimeout(() => {
        if (!models() || models().length)
          getModels();
        else
          resolve();
      }, 500);

    }
    getModels();
  })

}

main();

