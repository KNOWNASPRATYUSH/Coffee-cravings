// Single source of truth for the menu. Used by the customer site (browser) and the order API (server).
const MENU_ITEMS = [
  // COFFEE (HOT & ICED)
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Dark, rich espresso lying under a smoothed and stretched layer of thick milk foam.',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: true
  },
  {
    id: 'americano',
    name: 'Americano',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Espresso shots topped with hot water create a light layer of crema culminating in this wonderfully rich cup.',
    image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: true
  },
  {
    id: 'caffe-mocha',
    name: 'Caffé Mocha',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 159,
    description: 'Comforting mocha sauce and espresso meet steamed milk with delicate foam.',
    image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: true
  },
  {
    id: 'caffe-latte',
    name: 'Caffé Latte',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Rich, full-bodied espresso in steamed milk, lightly topped with velvety foam.',
    image: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: true
  },
  {
    id: 'latte-macchiato',
    name: 'Latte Macchiato',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 110,
    description: 'Steamed milk with marked espresso shots, creating layers of flavor.',
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=700&q=80',
    badge: 'Value',
    featured: true
  },
  {
    id: 'iced-latte',
    name: 'Iced Latte',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Chilled espresso combined with milk and poured over ice.',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=700&q=80',
    badge: 'Chilled',
    featured: false
  },
  {
    id: 'irish-latte',
    name: 'Irish Latte',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Aromatic espresso infused with non-alcoholic Irish cream notes and warm velvety milk.',
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=700&q=80',
    badge: 'Specialty',
    featured: false
  },

  // FRAPPES & COOLERS
  {
    id: 'hazelnut-frappe',
    name: 'Hazelnut Frappe',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 159,
    description: 'Blended roasted hazelnut syrup, chilled espresso, creamy milk and ice topped with whipped delight.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Signature',
    featured: true
  },
  {
    id: 'caramel-frappe',
    name: 'Caramel Frappe',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 139,
    description: 'Buttery caramel syrup blended with coffee, milk and ice with golden drizzle.',
    image: 'https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'french-vanilla-frappe',
    name: 'French Vanilla Frappe',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 139,
    description: 'Fragrant French vanilla blended cold with creamy milk and coffee.',
    image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: false
  },
  {
    id: 'choco-bin-laden',
    name: 'Choco Bin Laden',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 179,
    description: 'Our explosive chocolate explosion frappe packed with brownies, dark chocolate chips, and thick fudge sauce.',
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80',
    badge: 'Cafe Legend',
    featured: true
  },
  {
    id: 'spicy-lemonade',
    name: 'Spicy Lemonade',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 99,
    description: 'Tangy fresh squeezed lemon cooler with a hint of roasted cumin, mint, and desi spices.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80',
    badge: 'Refreshing',
    featured: false
  },

  // PASTAS & SNACKS
  {
    id: 'creamy-alfredo-pasta',
    name: 'Creamy Alfredo Pasta',
    category: 'pastas',
    categoryName: 'Pastas & Snacks',
    price: 219,
    description: 'Tender penne pasta tossed in our chef’s signature velvety parmesan cheese cream sauce with black olives and herbs.',
    image: 'https://i.vimeocdn.com/video/1972773852-c462373ce16cfc72992424520d893639a8402099a84c3667279fddacc986d86f-d_1920x1080?r=pad',
    badge: 'House Special',
    featured: true
  },
  {
    id: 'paneer-makhani',
    name: 'Paneer Makhani',
    category: 'pastas',
    categoryName: 'Pastas & Snacks',
    price: 269,
    description: 'Succulent cubes of cottage cheese prepared in a rich, velvety butter-tomato gravy with Indian spices.',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=700&q=80',
    badge: 'Gourmet',
    featured: false
  },
  {
    id: 'club-sandwich',
    name: 'Club Sandwich',
    category: 'pastas',
    categoryName: 'Pastas & Snacks',
    price: 149,
    description: 'Triple-decker toasted bread filled with fresh crisp garden greens, cheese slice, and creamy herb dressing.',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: false
  },

  // BURGERS & FRIES
  {
    id: 'classic-veg-burger',
    name: 'Classic Veg Burger',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 69,
    description: 'Golden spiced potato and vegetable patty in a toasted sesame bun with lettuce and mayo.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: false
  },
  {
    id: 'patted-paneer-burger',
    name: 'Patted Paneer Burger',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 119,
    description: 'Crispy seasoned paneer patty topped with melted cheddar, crunchy onions, and zesty secret sauce.',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80',
    badge: 'Chef Choice',
    featured: true
  },
  {
    id: 'salted-french-fries',
    name: 'Salted French Fries',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 59,
    description: 'Golden potato fries fried to perfection and dusted with sea salt.',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: false
  },
  {
    id: 'peri-peri-fries',
    name: 'Peri Peri Fries',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 79,
    description: 'Crispy crinkle-cut fries tossed vigorously in our bold and spicy peri-peri dust.',
    image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy',
    featured: false
  }
];
if (typeof module !== 'undefined') module.exports = MENU_ITEMS;
