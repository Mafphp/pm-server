const Base = require('./base.model');
const mongoose = require('mongoose');
const moment = require('moment');
const _const = require('./const.list');
const errors = require('./errors.list');
const socket = require('../socket');
const AgentModel = require('./agent.model');

class SMMessage extends Base {

  constructor(test = SMMessage.test) {

    super('SMMessage', test);
    this.test = test;
    this.SMMessageModel = this.model;
  }

  async pubishMessage(order_id, order_line_id, type, extra, desc = null) {
    try {
      let salesManager = await new AgentModel(this.test).getSalesManager()
      if (!salesManager)
        throw error.salesManagerNotFound;

      await this.SMMessageModel.create({
        type,
        order_id,
        order_line_id,
        desc,
        extra
      });

      if (!this.test)
        socket.sendToNS(salesManager._id)

    } catch (err) {
      console.log('-> error on publish sales manager message', err);
      throw err;
    }
  }

  async assignToReturn(id, preCheck, user) {
    try {

      if (!id)
        throw new Error('message id is required');

      let message = await this.SMMessageModel.findOne({
        _id: mongoose.Types.ObjectId(id)
      }).lean();

      if (!message.extra.address_id)
        throw new Error('return message must have address_id')

      let OrderModel = require('./order.model')
      let foundOrder, foundOrderLine;

      foundOrder = await new OrderModel(this.test).getById(message.order_id);
      if (!foundOrder)
        throw errors.orderNotFound;

      foundOrderLine = foundOrder.order_lines.find(x => x._id.toString() === message.order_line_id.toString());
      if (!foundOrderLine)
        throw errors.orderLineNotFound;

      if (!foundOrder.customer_id)
        throw new Error('cannot process return request of guest user');

      let CustomerModel = require('./customer.model');

      let foundCustomer = await new CustomerModel(this.test).getById(foundOrder.customer_id).lean();
      if (!foundCustomer)
        throw new Error('customer is not found to make return delivery');

      let foundedAddress = foundCustomer.addresses.find(x => x._id.toString() === message.extra.address_id.toString());
      if (!foundedAddress)
        throw new Error('address not found for customer to make return delivery');

      let DeliveryModel = require('./delivery.model');


      let foundDelivery = await new DeliveryModel(this.test).assignToReturn(foundedAddress, foundOrder, foundOrderLine, user.id, preCheck);

      if (preCheck)
        return Promise.resolve({
          address: foundedAddress,
          delivery: foundDelivery
        })

      await this.SMMessageModel.findOneAndUpdate({
        _id: mongoose.Types.ObjectId(id)
      }, {
          is_processed: true
        });

      if (!this.test)
        socket.sendToNS(user.id);

    } catch (err) {
      console.log('-> error on get active return delivery', err);
      throw err;
    }
  }

  async cancelNotExistOrder(id, cancelAll = false, user) {
    try {

      if (!id)
        throw new Error('message id is required');

      let message = await this.SMMessageModel.findOne({
        _id: mongoose.Types.ObjectId(id)
      }).lean();

      let OrderModel = require('./order.model')
      let TicketAction = require('./ticket_action.model');
      let foundOrder;

      foundOrder = await new OrderModel(this.test).getById(message.order_id);
      if (!foundOrder)
        throw errors.orderNotFound;

      await new TicketAction(this.test).requestCancel({
        orderId: foundOrder._id,
        orderLineId: foundOrder.order_lines.length && cancelAll ? null : message.order_line_id
      }, user);


      await this.SMMessageModel.findOneAndUpdate({
        _id: mongoose.Types.ObjectId(id)
      }, {
          is_processed: true
        });

      if (!this.test)
        socket.sendToNS(user.id);

    } catch (err) {
      console.log('-> error on cancel not existing order', err);
      throw err;
    }
  }

  async renewNotExistOrderline(id, user) {
    try {
      if (!id)
        throw new Error('message id is required');

      let message = await this.SMMessageModel.findOne({
        _id: mongoose.Types.ObjectId(id)
      }).lean();

      let OrderModel = require('./order.model')
      let foundOrder = await new OrderModel(this.test).getById(message.order_id);
      if (!foundOrder)
        throw errors.orderNotFound;

      let foundOrderLine = foundOrder.order_lines.find(x => x._id.toString() === message.order_line_id.toString());
      if (!foundOrderLine)
        throw errors.orderLineNotFound;


      let WarehouseModel = require('./warehouse.model');
      let warehouses = await new WarehouseModel(this.test).getWarehouses();

      let DSS = require('./dss.model');
      await new DSS(this.test).ORP(foundOrder, foundOrderLine, warehouses, null, true);

      await this.SMMessageModel.findOneAndUpdate({
        _id: mongoose.Types.ObjectId(id)
      }, {
          is_processed: true
        });

      if (!this.test)
        socket.sendToNS(user.id);

    } catch (err) {
      console.log('-> error on renew order line', err);
      throw err;
    }
  }

  async close(id, report, user) {
    try {
      if (!id || !report || !report.length)
        throw new Error('id and report are required to close the message');

      let foundMessage = await this.SMMessageModel.findOne({
        _id: mongoose.Types.ObjectId(id)
      }).lean();


      if (!foundMessage)
        throw new Error('message not found');


      await this.SMMessageModel.findOneAndUpdate({
        _id: foundMessage._id
      }, {
          $set: {
            report,
            is_closed: true,
            close_date: moment().toDate()
          }
        });

      if (!this.test)
        socket.sendToNS(user.id);

    } catch (err) {
      console.log('-> error on close message', err);
      throw err;
    }
  }

  async search(options, offset, limit) {

    try {

      let search;

      if (options && options.type === _const.LOGISTIC_SEARCH.SMInbox) {
        search = this.searchInbox(offset, limit);
      }
      if (options && options.type === _const.LOGISTIC_SEARCH.SMHistory) {
        search = this.searchHistory(offset, limit, options);
      }

      if (!search || !search.mainQuery || !search.countQuery)
        throw error.invalidSearchQuery;

      let result = await this.SMMessageModel.aggregate(search.mainQuery);
      let res = await this.SMMessageModel.aggregate(search.countQuery);
      let totalCount = res[0] ? res[0].count : 0;
      return Promise.resolve({
        data: result,
        total: totalCount,
      });

    } catch (err) {
      console.log('-> error on search in order');
      throw err;
    }

  }


  searchInbox(offset, limit) {
    const result = {
      mainQuery: [],
      countQuery: []
    };

    result.mainQuery = [
      {
        $match: {
          is_closed: false
        }
      },
      {
        $lookup: {
          from: 'order',
          localField: 'order_id',
          foreignField: '_id',
          as: 'order'
        }
      },
      {
        $unwind: {
          path: '$order',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$order.order_lines',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          is_processed: 1,
          type: 1,
          order: 1,
          extra: 1,
          publish_date: 1,
          cmp_value: {
            $cmp: ['$order.order_lines._id', '$order_line_id']
          }
        },
      },
      {
        $match: {
          cmp_value: {
            $eq: 0
          }
        }
      },
      {
        $lookup: {
          from: 'customer',
          localField: 'order.customer_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'product',
          localField: 'order.order_lines.product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$product.instances', // it makes product.instances, single element array for each instance
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          is_processed: 1,
          type: 1,
          order: 1,
          extra: 1,
          publish_date: 1,
          customer: 1,
          instance: {

            '_id': '$product.instances._id',
            'product_id': '$product._id',
            'product_name': '$product.name',
            'barcode': '$product.instances.barcode',
            'size': '$product.instances.size',
            'product_color_id': '$product.instances.product_color_id',
            'product_colors': '$product.colors'
          },
          cmp_value2: {
            $cmp: ['$order.order_lines.product_instance_id', '$product.instances._id']
          }
        },
      },
      {
        $match: {
          cmp_value2: {
            $eq: 0
          }
        }
      },
      {
        $skip: Number.parseInt(offset)
      },
      {
        $limit: Number.parseInt(limit)
      }
    ];

    result.countQuery = [
      {
        $match: {
          is_closed: false
        }
      },
      {
        $count: 'count'
      }
    ];

    return result;
  }

  searchHistory(offset, limit, body) {

    let timeMatching = {$and: []};
    if (body.startDateSearch) {
      let date1 = moment(moment(body.startDateSearch).format('YYYY-MM-DD')).set({
        'hour': '00',
        'minute': '00',
        'second': '00'
      }).toDate();

      timeMatching.$and.push({publish_date: {$gte: date1}});
    }

    if (body.endDateSearch) {
      let date2 = moment(moment(body.endDateSearch).format('YYYY-MM-DD')).set({
        'hour': '24',
        'minute': '00',
        'second': '00'
      }).toDate();
      timeMatching.$and.push({close_date: {$lte: date2}});
    }

    if (!body.startDateSearch && !body.endDateSearch) {
      timeMatching = {};
    }

    const result = {
      mainQuery: [],
      countQuery: []
    };

    result.mainQuery = [
      {
        $match: {
          is_closed: true
        }
      },
      {
        $lookup: {
          from: 'order',
          localField: 'order_id',
          foreignField: '_id',
          as: 'order'
        }
      },
      {
        $unwind: {
          path: '$order',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$order.order_lines',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          type: 1,
          order: 1,
          extra: 1,
          publish_date: 1,
          close_date: 1,
          report: 1,
          cmp_value: {
            $cmp: ['$order.order_lines._id', '$order_line_id']
          }
        },
      },
      {
        $match: {
          cmp_value: {
            $eq: 0
          }
        }
      },
      {
        $lookup: {
          from: 'customer',
          localField: 'order.customer_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'product',
          localField: 'order.order_lines.product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$product.instances', // it makes product.instances, single element array for each instance
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          type: 1,
          order: 1,
          extra: 1,
          publish_date: 1,
          close_date: 1,
          customer: 1,
          instance: {
            '_id': '$product.instances._id',
            'product_id': '$product._id',
            'product_name': '$product.name',
            'barcode': '$product.instances.barcode',
            'size': '$product.instances.size',
            'product_color_id': '$product.instances.product_color_id',
            'product_colors': '$product.colors'
          },
          report: 1,
          cmp_value2: {
            $cmp: ['$order.order_lines.product_instance_id', '$product.instances._id']
          }
        },
      },
      {
        $match: {
          cmp_value2: {
            $eq: 0
          }
        }
      },
      {
        $sort: {
          'publish_date': -1,
        }
      },
      {
        $match: timeMatching
      },
      {
        $skip: Number.parseInt(offset)
      },
      {
        $limit: Number.parseInt(limit)
      }
    ];

    result.countQuery = [
      {
        $match: {
          is_closed: true
        }
      },
      {
        $match: timeMatching
      },
      {
        $count: 'count'
      }
    ];

    return result;
  }
}

SMMessage.test = false;

module.exports = SMMessage;