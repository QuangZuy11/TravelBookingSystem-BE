const mongoose = require('mongoose');

const budgetBreakdownSchema = new mongoose.Schema({
  itinerary_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Itinerary',
    required: true
  },
  
  category: {
    type: String,
    enum: [
      'transportation',
      'accommodation',
      'meals',
      'activities',
      'entrance_fees',
      'guide_fees',
      'insurance',
      'equipment',
      'other'
    ],
    required: true
  },
  
  item_name: {
    type: String,
    required: true
  },
  
  description: {
    type: String
  },
  
  quantity: {
    type: Number,
    default: 1,
    min: 0
  },
  
  unit_price: {
    type: Number,
    required: true,
    min: 0
  },
  
  total_price: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'VND',
    enum: ['VND', 'USD', 'EUR']
  },
  
  // Cho phép khách hàng chọn optional items
  is_optional: {
    type: Boolean,
    default: false
  },
  
  // Included trong giá tour hay phải trả thêm
  is_included: {
    type: Boolean,
    default: true
  },
  
  // Ngày nào trong itinerary (Day 1, Day 2, etc.)
  day_number: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Link đến activity nếu có
  activity_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ItineraryActivity'
  },
  
  // Supplier/Vendor info
  supplier: {
    name: String,
    contact: String
  },
  
  notes: {
    type: String
  },
  
  created_at: {
    type: Date,
    default: Date.now
  },
  
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
budgetBreakdownSchema.index({ itinerary_id: 1, day_number: 1 });
budgetBreakdownSchema.index({ itinerary_id: 1, category: 1 });
budgetBreakdownSchema.index({ activity_id: 1 });

// Pre-save hook để tính total_price
budgetBreakdownSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unit_price')) {
    this.total_price = this.quantity * this.unit_price;
  }
  next();
});

// Static method để tính tổng budget của itinerary
budgetBreakdownSchema.statics.calculateItineraryTotal = async function(itineraryId) {
  const result = await this.aggregate([
    { $match: { itinerary_id: new mongoose.Types.ObjectId(itineraryId) } },
    {
      $group: {
        _id: null,
        total: { $sum: '$total_price' },
        included_total: {
          $sum: {
            $cond: ['$is_included', '$total_price', 0]
          }
        },
        optional_total: {
          $sum: {
            $cond: ['$is_optional', '$total_price', 0]
          }
        }
      }
    }
  ]);
  
  return result[0] || { total: 0, included_total: 0, optional_total: 0 };
};

// Static method để tính budget theo category
budgetBreakdownSchema.statics.calculateByCategory = async function(itineraryId) {
  return await this.aggregate([
    { $match: { itinerary_id: new mongoose.Types.ObjectId(itineraryId) } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$total_price' },
        items_count: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } }
  ]);
};

module.exports = mongoose.model('BudgetBreakdown', budgetBreakdownSchema, 'BUDGET_BREAKDOWN');
