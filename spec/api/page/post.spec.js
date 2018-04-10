const rp = require('request-promise');
const lib = require('../../../lib/index');
const models = require('../../../mongo/models.mongo');
const mongoose = require('mongoose');
const errors = require('../../../lib/errors.list');

describe('Post page basics', () => {

  let basicPageId;
  let adminObj = {
    aid: null,
    jar: null,
  };

  beforeEach(done => {
    lib.dbHelpers.dropAll()
      .then(() => lib.dbHelpers.addAndLoginAgent('admin'))
      .then(res => {
        adminObj.aid = res.aid;
        adminObj.jar = res.rpJar;
        let basicPage = models['PageTest']({
          address: 'sampleAddress',
          is_app: false,

        });
        return basicPage.save();
      })
      .then(res => {
        basicPageId = res._id;
        done();
      })
      .catch(err => {
        console.error(err);
        done();
      });
  });

  it('should update basic info of page', function (done) {

    this.done = done;
    let collectionId = new mongoose.Types.ObjectId();

    rp({
      method: 'post',
      uri: lib.helpers.apiTestURL(`page/${basicPageId}`),
      body: {
        address: 'changedAddress',
        is_app: true,
        collection_id: collectionId
      },
      jar: adminObj.jar,
      json: true,
      resolveWithFullResponse: true
    }).then(res => {
      expect(res.statusCode).toBe(200);
      return models['PageTest'].find({}).lean();

    }).then(res => {
      expect(res[0].address).toBe('changedAddress');
      expect(res[0].is_app).toBe(true);
      expect(res[0].page_info.collection_id.toString()).toBe(collectionId.toString());
      done();

    })
      .catch(lib.helpers.errorHandler.bind(this));
  });
});

describe('Post page placements and page info', () => {
  let page, collection_id;
  beforeEach(done => {
    lib.dbHelpers.dropAll()
      .then(res => {
        let inserts = [];
        collection_id = new mongoose.Types.ObjectId();

        page = models['PageTest']({
          address: 'test',
          is_app: false,
          placement: [
            {
              component_name: 'main'
            },
            {
              component_name: 'slider'
            },
            {
              component_name: 'menu'
            },
            {
              component_name: 'slider'
            },
            {
              component_name: 'main'
            },
            {
              component_name: 'menu'
            },
            {
              component_name: 'menu'
            },
          ],
          page_info: {
            collection_id: collection_id,
            content: 'sample content'

          }
        });

        return page.save()

      })
      .then(res => {
        done();
      })
      .catch(err => {
        console.error(err);
        done();
      });
  });

  it('should get page placements and page info of a website page using its address', function (done) {
    this.done = done;

    rp({
      method: 'post',
      uri: lib.helpers.apiTestURL(`page`),
      body: {
        address: page.address
      },
      json: true,
      resolveWithFullResponse: true
    }).then(res => {
      expect(res.statusCode).toBe(200);
      let result = res.body;
      expect(result.placement.length).toBe(7);
      expect(result.page_info.collection_id.toString()).toBe(collection_id.toString());
      expect(result.page_info.content).toBe('sample content');
      done();

    })
      .catch(lib.helpers.errorHandler.bind(this));
  });


});

describe('POST placement (top menu)', () => {
  let page, collection_id, contentManager;
  const placementId1 = new mongoose.Types.ObjectId();
  const placementId2 = new mongoose.Types.ObjectId();
  const placementId3 = new mongoose.Types.ObjectId();
  const placementId4 = new mongoose.Types.ObjectId();
  const placementId5 = new mongoose.Types.ObjectId();
  const placementId6 = new mongoose.Types.ObjectId();

  beforeEach(done => {
    lib.dbHelpers.dropAll()
      .then(() => {
        return lib.dbHelpers.addAndLoginAgent('cm');
      })
      .then(res => {
        contentManager = res;

        collection_id = new mongoose.Types.ObjectId();

        page = models['PageTest']({
          address: 'test',
          is_app: false,
          placement: [
            {
              "_id": placementId1,
              "component_name": "menu",
              "variable_name": "topMenu",
              "info": {
                "column": "0",
                "text": "مردانه",
                "section": "men",
                "href": "collection/men"
              }
            },
            {
              "_id": placementId2,
              "component_name": "menu",
              "variable_name": "subMenu",
              "info": {
                "section": "men/header",
                "column": 1,
                "row": 1,
                "text": "تازه‌ها",
                "href": "collection/x"
              }
            },
            {
              "_id": placementId3,
              "component_name": "slider",
              "variable_name": "پس گرفتن جنس خریداری شده تا ۳۰ روز",
              "start_date": "",
              "end_date": "",
              "info": {
                "column": 1,
                "imgUrl": "assets/cliparts/return.png",
                "href": "#",
                "style": {
                  "imgWidth": 30,
                  "imgMarginLeft": 5
                }
              }
            },
            {
              "_id": placementId4,
              "component_name": "menu",
              "variable_name": "topMenu",
              "info": {
                "column": "1",
                "text": "زنانه",
                "section": "women",
                "href": "collection/women"
              }
            },
            {
              "_id": placementId5,
              "component_name": "menu",
              "variable_name": "topMenu",
              "info": {
                "column": "2",
                "text": "دخترانه",
                "section": "girls",
                "href": "collection/girls"
              }
            },
            {
              "_id": placementId6,
              "component_name": "menu",
              "variable_name": "topMenu",
              "info": {
                "column": "3",
                "text": "پسرانه",
                "section": "boys",
                "href": "collection/boys"
              }
            }
          ],
          page_info: {
            collection_id: collection_id,
            content: 'sample content'

          }
        });

        return page.save()

      })
      .then(res => {
        done();
      })
      .catch(err => {
        console.error(err);
        done();
      });
  });

  it("content manager should apply updated details to the top menu items (update placement)", function (done) {
    this.done = done;
    rp({
      method: 'post',
      body: {
        page_id: page._id,
        placements: [
          {
            "_id": placementId1,
            "info": {
              "column": "3",
              "text": "مردانه - جدید",
              "href": "collection/men"
            }
          },
          {
            "_id": placementId4,
            "info": {
              "column": "1",
              "text": "زنانه",
              "href": "collection/women"
            }
          },
          {
            "_id": placementId5,
            "info": {
              "column": "0",
              "text": "دخترانه",
              "href": "collection/girls"
            }
          },
          {
            "_id": placementId6,
            "info": {
              "column": "2",
              "text": "پسرانه",
              "href": "collection/boys",
              "section": 'bad_boys',
            }
          }]
      },
      uri: lib.helpers.apiTestURL('placement'),
      json: true,
      jar: contentManager.rpJar,
      resolveWithFullResponse: true,
    })
      .then(res => {
        expect(res.statusCode).toBe(200);
        return models['PageTest'].find({_id: page._id}).lean();
      })
      .then(res => {
        res = res[0].placement.filter(el => el.component_name === 'menu' && el.variable_name === 'topMenu');
        expect(res.length).toBe(4);
        expect(res.find(el => el.info.href === 'collection/girls').info.column).toBe(0);
        expect(res.find(el => el.info.href === 'collection/women').info.column).toBe(1);
        expect(res.find(el => el.info.href === 'collection/boys').info.column).toBe(2);
        expect(res.find(el => el.info.href === 'collection/boys').info.section).toBe('boys');
        expect(res.find(el => el.info.href === 'collection/men').info.column).toBe(3);
        done();
      })
      .catch(lib.helpers.errorHandler.bind(this));
  });

  it("should get error when no id is specified for placement (update placement)", function (done) {
    rp({
      method: 'post',
      body: {
        page_id: page._id,
        placements: [
          {
            "_id": placementId1,
            "component_name": "menu",
            "variable_name": "topMenu",
            "info": {
              "column": "3",
              "text": "مردانه - جدید",
              "href": "collection/men"
            }
          },
          {
            "component_name": "menu",
            "variable_name": "topMenu",
            "info": {
              "column": "1",
              "text": "زنانه",
              "href": "collection/women"
            }
          }
        ]
      },
      uri: lib.helpers.apiTestURL('placement'),
      jar: contentManager.rpJar,
      json: true,
      resolveWithFullResponse: true,
    })
      .then(res => {
        this.fail('Content manager can update without specifies placement id');
        done();
      })
      .catch(err => {
        expect(err.statusCode).toBe(errors.placementIdRequired.status);
        expect(err.error).toBe(errors.placementIdRequired.message);
        done();
      });
  });

  it("should get error when page is not is specified", function (done) {
    rp({
      method: 'post',
      body: {
        placements: [
          {
            "_id": placementId1,
            "component_name": "menu",
            "variable_name": "topMenu",
            "info": {
              "column": "3",
              "text": "مردانه - جدید",
              "href": "collection/men"
            }
          },
          {
            "_id": placementId2,
            "component_name": "menu",
            "variable_name": "topMenu",
            "info": {
              "column": "1",
              "text": "زنانه",
              "href": "collection/women"
            }
          }
        ]
      },
      json: true,
      jar: contentManager.rpJar,
      uri: lib.helpers.apiTestURL('placement'),
      resolveWithFullResponse: true,
    })
      .then(res => {
        this.fail("Content manager can delete a placement without specified page id");
        done();
      })
      .catch(err => {
        expect(err.statusCode).toBe(errors.pageIdRequired.status);
        expect(err.error).toBe(errors.pageIdRequired.message);
        done();
      });
  });

  it("content manager should delete placement (delete placement)", function (done) {
    this.done = done;
    rp({
      method: 'post',
      body: {
        page_id: page._id,
        placement_id: placementId1,
      },
      json: true,
      jar: contentManager.rpJar,
      uri: lib.helpers.apiTestURL('placement/delete'),
      resolveWithFullResponse: true,
    })
      .then(res => {
        expect(res.statusCode).toBe(200);
        return models['PageTest'].find({_id: page._id}).lean();
      })
      .then(res => {
        res = res[0].placement.filter(el => el.component_name === 'menu' && el.variable_name === 'topMenu');
        expect(res.length).toBe(3);
        expect(res.find(el => el._id.toString() === placementId1.toString())).toBeUndefined();
        done();
      })
      .catch(lib.helpers.errorHandler.bind(this));
  });

  it("should get error when no page's id is not specified (delete placement)", function (done) {
    rp({
      method: 'post',
      body: {
        placement_id: placementId1,
      },
      json: true,
      jar: contentManager.rpJar,
      uri: lib.helpers.apiTestURL('placement/delete'),
      resolveWithFullResponse: true,
    })
      .then(res => {
        this.fail("Content manager can delete a placement without specified page id");
        done();
      })
      .catch(err => {
        expect(err.statusCode).toBe(errors.pageIdRequired.status);
        expect(err.error).toBe(errors.pageIdRequired.message);
        done();
      });
  });

  it("should get error when placement id is not passed (delete placement)", function (done) {
    rp({
      method: 'post',
      body: {
        page_id: page._id,
      },
      json: true,
      jar: contentManager.rpJar,
      uri: lib.helpers.apiTestURL('placement/delete'),
      resolveWithFullResponse: true,
    })
      .then(res => {
        this.fail("Content manager can delete a placement without specified placement id");
        done();
      })
      .catch(err => {
        expect(err.statusCode).toBe(errors.placementIdRequired.status);
        expect(err.error).toBe(errors.placementIdRequired.message);
        done();
      });
  });
});
