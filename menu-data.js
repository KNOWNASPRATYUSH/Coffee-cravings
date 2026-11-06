// Single source of truth for the Coffee & Cravings menu.
// Used by the customer site (browser) and the order API (server).

const MENU_ITEMS = [
  // ---------------------------------------------------------------------------
  // 1. COFFEE
  // ---------------------------------------------------------------------------
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 159,
    description: 'Dark, rich espresso lying under a smoothed and stretched layer of thick milk foam.',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: true
  },
  {
    id: 'caffe-latte',
    name: 'Caffé Latte',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 149,
    description: 'Rich, full-bodied espresso in steamed milk, lightly topped with delicate foam.',
    image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: true
  },
  {
    id: 'americano',
    name: 'Americano',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 139,
    description: 'Espresso shots topped with hot water create a light layer of crema in this wonderfully rich cup.',
    image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: true
  },
  {
    id: 'caffe-mocha',
    name: 'Caffé Mocha',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 189,
    description: 'Comforting mocha sauce and espresso meet steamed milk with delicate foam.',
    image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=700&q=80',
    badge: 'Rich & Chocolaty',
    featured: true
  },
  {
    id: 'caramel-cappuccino',
    name: 'Caramel Cappuccino',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 179,
    description: 'Velvety espresso cappuccino infused with handcrafted golden caramel syrup.',
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'hazelnut-cappuccino',
    name: 'Hazelnut Cappuccino',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 179,
    description: 'Fresh espresso and steamed frothy milk flavored with roasted European hazelnuts.',
    image: 'https://images.unsplash.com/photo-1585494156145-1c60a4fe9d2b?auto=format&fit=crop&w=700&q=80',
    badge: 'Must Try',
    featured: false
  },
  {
    id: 'dalgona-hot-coffee',
    name: 'Dalgona Hot Coffee',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 89,
    description: 'Thick whipped golden coffee cream spooned luxuriously over piping hot milk.',
    image: 'https://images.unsplash.com/photo-1587080413959-06b859fb107d?auto=format&fit=crop&w=700&q=80',
    badge: 'Trending',
    featured: false
  },
  {
    id: 'masala-chai',
    name: 'Masala Chai',
    category: 'coffee',
    categoryName: 'Coffee',
    price: 89,
    description: 'Traditional aromatic Indian spiced tea brewed with ginger, cardamom, and fresh whole milk.',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=700&q=80',
    badge: 'Special',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 2. FRAPPE AND ICED
  // ---------------------------------------------------------------------------
  {
    id: 'og-cold-coffee',
    name: 'OG Cold Coffee',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 99,
    description: 'Our legendary original creamy blended cold coffee, chilled to perfection.',
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: true
  },
  {
    id: 'iced-latte',
    name: 'Iced Latte',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 129,
    description: 'Espresso combined with chilled milk and served over ice cubes.',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: false
  },
  {
    id: 'vietnamese-iced-latte',
    name: 'Vietnamese Iced Latte',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 179,
    description: 'Intense drip-style dark coffee sweetened with decadent condensed milk over cracked ice.',
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=700&q=80',
    badge: 'Signature',
    featured: true
  },
  {
    id: 'hazelnut-frappe',
    name: 'Hazelnut Frappe',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 159,
    description: 'Roasted hazelnut flavor blended with coffee, creamy milk, and crushed ice.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Must Try',
    featured: false
  },
  {
    id: 'french-vanilla-frappe',
    name: 'French Vanilla Frappe',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 149,
    description: 'A luscious blend of aromatic French vanilla extract, rich espresso, and velvety milk.',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf537b036?auto=format&fit=crop&w=700&q=80',
    badge: 'Sweet & Creamy',
    featured: false
  },
  {
    id: 'caramel-frappe',
    name: 'Caramel Frappe',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 139,
    description: 'Buttery caramel syrup blended with fresh coffee, cold milk, and crushed ice.',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'iced-mocha',
    name: 'Iced Mocha',
    category: 'frappes',
    categoryName: 'Frappe & Iced',
    price: 159,
    description: 'Espresso mixed with bittersweet cocoa sauce, chilled milk, and served over ice.',
    image: 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?auto=format&fit=crop&w=700&q=80',
    badge: 'Choco Delight',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 3. HOT CHOCOLATES
  // ---------------------------------------------------------------------------
  {
    id: 'belgian-hot-chocolate',
    name: 'Belgian Hot Chocolate',
    category: 'hot-chocolate',
    categoryName: 'Hot Chocolates',
    price: 139,
    description: 'Real melted Belgian chocolate stirred with rich steamed milk for the ultimate cocoa warmth.',
    image: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: true
  },
  {
    id: 'hazelnut-hot-chocolate',
    name: 'Hazelnut Hot Chocolate',
    category: 'hot-chocolate',
    categoryName: 'Hot Chocolates',
    price: 159,
    description: 'Warm velvety Belgian chocolate infused with roasted aromatic hazelnut praline.',
    image: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'irish-cream-hot-chocolate',
    name: 'Irish Cream Hot Chocolate',
    category: 'hot-chocolate',
    categoryName: 'Hot Chocolates',
    price: 159,
    description: 'Decadent chocolate ganache with a non-alcoholic Irish cream infusion.',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=700&q=80',
    badge: 'Chef Special',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 4. CLASSIC SHAKES
  // ---------------------------------------------------------------------------
  {
    id: 'strawberry-shake',
    name: 'Strawberry Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 79,
    description: 'Refreshing milkshake prepared with sun-ripened strawberry puree and vanilla cream.',
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=700&q=80',
    badge: 'Fruity',
    featured: false
  },
  {
    id: 'mango-shake',
    name: 'Mango Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 79,
    description: 'Thick creamy mango shake made from golden sweet alphonso pulp.',
    image: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=700&q=80',
    badge: 'Summer Special',
    featured: false
  },
  {
    id: 'banana-shake',
    name: 'Banana Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 79,
    description: 'Wholesome nutritious banana shake blended thick with honey and fresh milk.',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=700&q=80',
    badge: 'Energy',
    featured: false
  },
  {
    id: 'black-currant-shake',
    name: 'Black Currant Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 79,
    description: 'Tangy-sweet wild black currant berries blended into rich chilled ice milk.',
    image: 'https://images.unsplash.com/photo-1553787499-6f9133860278?auto=format&fit=crop&w=700&q=80',
    badge: 'Tangy Delight',
    featured: false
  },
  {
    id: 'oreo-slush',
    name: 'Oreo Slush',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 89,
    description: 'Crushed chocolate Oreo cookies blended with icy milk and chocolate drizzle.',
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'choco-coco-shake',
    name: 'Choco-Coco Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 99,
    description: 'Rich dark cocoa and tropical coconut cream blended into a luscious milkshake.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'New',
    featured: false
  },
  {
    id: 'butterscotch-ice-cream-shake',
    name: 'Butterscotch Ice Cream Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 99,
    description: 'Creamy butterscotch ice cream shake with crunchy caramelized praline bits.',
    image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: false
  },
  {
    id: 'vanilla-ice-cream-shake',
    name: 'Vanilla Ice Cream Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 99,
    description: 'All-time favorite thick shake crafted with double scoops of vanilla ice cream.',
    image: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: false
  },
  {
    id: 'kesar-pista-ice-cream-shake',
    name: 'Kesar-Pista Ice Cream Shake',
    category: 'classic-shakes',
    categoryName: 'Classic Shakes',
    price: 99,
    description: 'Royal saffron kesar and toasted pistachio ice cream shake garnished with nuts.',
    image: 'https://images.unsplash.com/photo-1579954115567-dff2eeb6fdeb?auto=format&fit=crop&w=700&q=80',
    badge: 'Royal Taste',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 5. PREMIUM SHAKES
  // ---------------------------------------------------------------------------
  {
    id: 'caramel-oreo-shake',
    name: 'Caramel Oreo',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 149,
    description: 'Crunchy Oreo biscuit crumbles swirled with decadent salted caramel ribbon.',
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'caramel-chocochips-shake',
    name: 'Caramel Chocochips',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 149,
    description: 'Caramel infused thick shake loaded with rich crunchy dark chocochips.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Crunchy',
    featured: false
  },
  {
    id: 'chocochip-shake',
    name: 'Chocochip Shake',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 149,
    description: 'Decadent chocolate shake loaded with generous bites of semi-sweet chocolate morsels.',
    image: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=700&q=80',
    badge: 'All Time Fav',
    featured: false
  },
  {
    id: 'hazelnut-chocochips-shake',
    name: 'Hazelnut Chocochips',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 179,
    description: 'Nutty hazelnut blend paired with chocolate chips and chocolate drizzle.',
    image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=700&q=80',
    badge: 'Nutty',
    featured: false
  },
  {
    id: 'oreo-kitkat-mudshake',
    name: 'Oreo Kitkat Mudshake',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 199,
    description: 'Heavyweight indulgence blending crunchy KitKat wafers, Oreo cookies, and chocolate fudge.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Must Try',
    featured: true
  },
  {
    id: 'real-fruit-shake',
    name: 'Real Fruit Shake',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 199,
    description: 'Blended with seasonal fresh orchard fruits and rich ice cream for pure natural goodness.',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=700&q=80',
    badge: 'Fresh',
    featured: false
  },
  {
    id: 'butter-popcorn-shake',
    name: 'Butter Popcorn Shake',
    category: 'premium-shakes',
    categoryName: 'Premium Shakes',
    price: 199,
    description: 'Innovative cinema-style sweet and salty buttered popcorn milkshake topped with popcorn.',
    image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=700&q=80',
    badge: 'House Special',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 6. MOCKTAILS
  // ---------------------------------------------------------------------------
  {
    id: 'virgin-mint-mojito',
    name: 'Virgin Mint Mojito',
    category: 'mocktails',
    categoryName: 'Mocktails',
    price: 99,
    description: 'Fresh muddled garden mint leaves, tangy lime wedges, simple syrup, and sparkling soda.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80',
    badge: 'Refreshing',
    featured: true
  },
  {
    id: 'watermelon-cruiser',
    name: 'Watermelon Cruiser',
    category: 'mocktails',
    categoryName: 'Mocktails',
    price: 99,
    description: 'Crisp watermelon cooler with a splash of citrus and bubbly soda over crushed ice.',
    image: 'https://images.unsplash.com/photo-1587888637140-849b25d80ef9?auto=format&fit=crop&w=700&q=80',
    badge: 'Cooler',
    featured: false
  },
  {
    id: 'spicy-lemonade',
    name: 'Spicy Lemonade',
    category: 'mocktails',
    categoryName: 'Mocktails',
    price: 99,
    description: 'Zesty fresh lemon juice with a fiery Indian spice kick and cooling mint over ice.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy Tang',
    featured: false
  },
  {
    id: 'green-apple-crusher',
    name: 'Green Apple Crusher',
    category: 'mocktails',
    categoryName: 'Mocktails',
    price: 139,
    description: 'Tart crisp green apple cooler poured over shaved ice with sparkling effervescence.',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=700&q=80',
    badge: 'Crisp',
    featured: false
  },
  {
    id: 'peach-iced-tea',
    name: 'Peach Iced Tea',
    category: 'mocktails',
    categoryName: 'Mocktails',
    price: 99,
    description: 'Slow-brewed black tea lightly sweetened and infused with fragrant ripe orchard peaches.',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: false
  },
  {
    id: 'lemon-iced-tea',
    name: 'Lemon Iced Tea',
    category: 'mocktails',
    categoryName: 'Mocktails',
    price: 99,
    description: 'Chilled steeped tea accented with freshly squeezed lemon juice and mint.',
    image: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=700&q=80',
    badge: 'All Time Fav',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 7. BURGERS & SANDWICHES
  // ---------------------------------------------------------------------------
  {
    id: 'mexican-salsa-burger',
    name: 'Mexican Salsa Burger',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 89,
    description: 'Crispy seasoned vegetable patty layered with zesty Mexican tomato salsa and mayo.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy Salsa',
    featured: false
  },
  {
    id: 'cheesy-cheese-burger',
    name: 'Cheesy Cheese Burger',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 99,
    description: 'Juicy golden burger smothered in double molten cheddar cheese sauce.',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80',
    badge: 'Cheesy',
    featured: false
  },
  {
    id: 'cravings-spl-burger',
    name: 'Cravings Spl. Burger',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 159,
    description: 'Our grand house-specialty burger with loaded paneer patty, caramelized onions, and secret sauce.',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=700&q=80',
    badge: 'House Special',
    featured: true
  },
  {
    id: 'veg-cheese-sandwich',
    name: 'Veg & Cheese Sandwich',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 149,
    description: 'Toasted whole wheat bread stuffed with crisp bell peppers, sweet corn, and melted mozzarella.',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'paneer-masala-sandwich',
    name: 'Paneer Masala Sandwich',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 179,
    description: 'Grilled sandwich packed with tandoori-spiced cottage cheese cubes and fresh cilantro mint chutney.',
    image: 'https://images.unsplash.com/photo-1554433607-66b5efe9d304?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy Desi',
    featured: false
  },
  {
    id: 'cheese-corn-sandwich',
    name: 'Cheese Corn Sandwich',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 179,
    description: 'Golden sweet corn kernels smothered in gooey melted cheddar on toasted crusty bread.',
    image: 'https://images.unsplash.com/photo-1619096252214-efc6b45d2971?auto=format&fit=crop&w=700&q=80',
    badge: 'Comfort',
    featured: false
  },
  {
    id: 'club-sandwich',
    name: 'Club Sandwich',
    category: 'burgers',
    categoryName: 'Burgers & Sandwiches',
    price: 199,
    description: 'Triple-decker toasted sandwich packed with fresh veggies, cheese slice, herb slaw, and fries.',
    image: 'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?auto=format&fit=crop&w=700&q=80',
    badge: 'Triple Decker',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 8. PASTA
  // ---------------------------------------------------------------------------
  {
    id: 'penne-arrabiata',
    name: 'Penne Arrabiata',
    category: 'pasta',
    categoryName: 'Pasta',
    price: 179,
    description: 'Al dente penne pasta tossed in a fiery Italian garlic and red chili tomato basil sauce.',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d62810ef?auto=format&fit=crop&w=700&q=80',
    badge: 'Red Sauce',
    featured: false
  },
  {
    id: 'penne-alfredo',
    name: 'Penne Alfredo',
    category: 'pasta',
    categoryName: 'Pasta',
    price: 189,
    description: 'Penne smothered in a rich, velvety parmesan white cream sauce with cracked black pepper.',
    image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=700&q=80',
    badge: 'White Sauce',
    featured: true
  },
  {
    id: 'spaghetti-arrabiata',
    name: 'Spaghetti Arrabiata',
    category: 'pasta',
    categoryName: 'Pasta',
    price: 229,
    description: 'Classic long spaghetti noodles cooked with piquant tomato pomodoro and fresh herbs.',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy',
    featured: false
  },
  {
    id: 'spaghetti-alfredo',
    name: 'Spaghetti Alfredo',
    category: 'pasta',
    categoryName: 'Pasta',
    price: 239,
    description: 'Silky spaghetti noodles coated in rich butter, fresh cream, and shredded parmesan.',
    image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=700&q=80',
    badge: 'Rich & Creamy',
    featured: false
  },
  {
    id: 'mix-sauce-pasta',
    name: 'Mix Sauce Pasta',
    category: 'pasta',
    categoryName: 'Pasta',
    price: 249,
    description: 'The perfect pink sauce harmony of tangy red pomodoro and velvety alfredo white cream.',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=700&q=80',
    badge: 'Pink Sauce',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 9. PIZZA
  // ---------------------------------------------------------------------------
  {
    id: 'margherita-pizza',
    name: 'Margherita Pizza',
    category: 'pizza',
    categoryName: 'Pizza',
    price: 199,
    description: 'Crispy stone-baked crust topped with herbed Italian tomato sauce, mozzarella, and fresh basil.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: true
  },
  {
    id: 'veggie-delight-pizza',
    name: 'Veggie Delight Pizza',
    category: 'pizza',
    categoryName: 'Pizza',
    price: 239,
    description: 'Loaded with crunchy capsicum, red onions, mushrooms, juicy tomatoes, and golden mozzarella.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80',
    badge: 'Loaded Veg',
    featured: false
  },
  {
    id: 'sweet-corn-pizza',
    name: 'Sweet Corn Pizza',
    category: 'pizza',
    categoryName: 'Pizza',
    price: 249,
    description: 'Crispy crust topped with tender sweet American corn kernels and stringy mozzarella.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'farmhouse-cheese-pizza',
    name: 'Farmhouse Cheese Pizza',
    category: 'pizza',
    categoryName: 'Pizza',
    price: 279,
    description: 'Rustic garden pizza bursting with bell peppers, olives, jalapenos, and premium cheese blend.',
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=700&q=80',
    badge: 'Chef Special',
    featured: false
  },
  {
    id: 'paneer-makhani-pizza',
    name: 'Paneer Makhani Pizza',
    category: 'pizza',
    categoryName: 'Pizza',
    price: 299,
    description: 'Desi fusion pizza with smoky marinated tandoori paneer over a buttery makhani sauce base.',
    image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=700&q=80',
    badge: 'Desi Fusion',
    featured: false
  },
  {
    id: 'cravings-signature-pizza',
    name: 'Cravings Signature Pizza',
    category: 'pizza',
    categoryName: 'Pizza',
    price: 349,
    description: 'The ultimate royal pizza loaded with paneer, olives, jalapenos, mushrooms, corn, and 4-cheese burst.',
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=700&q=80',
    badge: 'Royal Burst',
    featured: true
  },

  // ---------------------------------------------------------------------------
  // 10. FRIES & SIDES
  // ---------------------------------------------------------------------------
  {
    id: 'salted-french-fries',
    name: 'Salted French Fries',
    category: 'fries-sides',
    categoryName: 'Fries & Sides',
    price: 79,
    description: 'Golden-brown crispy potato fries lightly sprinkled with sea salt.',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=700&q=80',
    badge: 'Crunchy',
    featured: false
  },
  {
    id: 'peri-peri-fries',
    name: 'Peri Peri Fries',
    category: 'fries-sides',
    categoryName: 'Fries & Sides',
    price: 89,
    description: 'Crispy fries generously tossed in our signature fiery African peri-peri seasoning.',
    image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy',
    featured: true
  },
  {
    id: 'crispy-cheese-sticks',
    name: 'Crispy Cheese sticks',
    category: 'fries-sides',
    categoryName: 'Fries & Sides',
    price: 179,
    description: 'Crumb-coated golden mozzarella cheese sticks fried crisp, served with herbed dip.',
    image: 'https://images.unsplash.com/photo-1531749668029-2db88e4276c7?auto=format&fit=crop&w=700&q=80',
    badge: 'Cheesy Pull',
    featured: false
  },
  {
    id: 'garlic-cheese-toast',
    name: 'Garlic Cheese Toast',
    category: 'fries-sides',
    categoryName: 'Fries & Sides',
    price: 99,
    description: 'Oven-toasted bread rubbed with roasted garlic butter and bubbly melted cheese.',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=700&q=80',
    badge: 'Garlic Crunch',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 11. BELGIAN WAFFLES
  // ---------------------------------------------------------------------------
  {
    id: 'kitkat-break-waffle',
    name: 'Kitkat Break',
    category: 'waffles',
    categoryName: 'Belgian Waffles',
    price: 169,
    description: 'Crispy Belgian waffle crowned with crushed KitKat fingers, rich chocolate sauce, and icing sugar.',
    image: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=700&q=80',
    badge: 'Crunchy',
    featured: false
  },
  {
    id: 'red-velvet-cream-waffle',
    name: 'Red Velvet Cream',
    category: 'waffles',
    categoryName: 'Belgian Waffles',
    price: 179,
    description: 'Signature scarlet red velvet waffle served with whipped white cream cheese frosting.',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=700&q=80',
    badge: 'Sweet Sensation',
    featured: false
  },
  {
    id: 'triple-chocolate-therapy-waffle',
    name: 'Triple Chocolate Therapy',
    category: 'waffles',
    categoryName: 'Belgian Waffles',
    price: 189,
    description: 'A chocolate lover’s dream: milk, dark, and white chocolate ganache drizzled over hot crisp waffle.',
    image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=700&q=80',
    badge: 'Triple Choco',
    featured: true
  },
  {
    id: 'nutella-banana-waffle',
    name: 'Nutella & Banana',
    category: 'waffles',
    categoryName: 'Belgian Waffles',
    price: 229,
    description: 'Warm waffle slathered with genuine Italian Nutella and sliced fresh caramelized bananas.',
    image: 'https://images.unsplash.com/photo-1568051243851-f9b136146e97?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 12. DESSERTS
  // ---------------------------------------------------------------------------
  {
    id: 'belgian-banoffee-pancake',
    name: 'Belgian Banoffee Pancake',
    category: 'desserts',
    categoryName: 'Desserts',
    price: 259,
    description: 'Fluffy stacked pancakes topped with dulce de leche toffee sauce, sliced bananas, and whipped cream.',
    image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=700&q=80',
    badge: 'Decadent',
    featured: false
  },
  {
    id: 'cheesecake',
    name: 'Cheesecake',
    category: 'desserts',
    categoryName: 'Desserts',
    price: 199,
    description: 'Silky smooth New York style baked cheesecake over a buttery graham cracker crumb crust.',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80',
    badge: 'Silky Smooth',
    featured: true
  },
  {
    id: 'italian-tiramisu',
    name: 'Italian Tiramisu',
    category: 'desserts',
    categoryName: 'Desserts',
    price: 229,
    description: 'Authentic espresso-soaked ladyfinger biscuits layered with airy mascarpone mousse and cocoa.',
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=700&q=80',
    badge: 'Authentic',
    featured: false
  },
  {
    id: 'brownie-sizzler',
    name: 'Brownie Sizzler',
    category: 'desserts',
    categoryName: 'Desserts',
    price: 209,
    description: 'Fudgy walnut brownie served on a piping hot iron sizzler plate with vanilla ice cream and hot fudge.',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80',
    badge: 'Sizzling Hot',
    featured: true
  },

  // ---------------------------------------------------------------------------
  // 13. BUDGET MEALS
  // ---------------------------------------------------------------------------
  {
    id: 'combo-sandwich-solo',
    name: 'Sandwich Solo',
    category: 'budget-meals',
    categoryName: 'Budget Meals',
    price: 199,
    description: 'Veg & Cheese Sandwich + Cold Coffee combo meal.',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80',
    badge: 'Value Combo',
    featured: false
  },
  {
    id: 'combo-pasta-chill',
    name: 'Pasta Chill',
    category: 'budget-meals',
    categoryName: 'Budget Meals',
    price: 249,
    description: 'Penne Arrabiata + Peach Iced Tea combo meal.',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d62810ef?auto=format&fit=crop&w=700&q=80',
    badge: 'Value Combo',
    featured: false
  },
  {
    id: 'combo-pizza-date',
    name: 'Pizza Date',
    category: 'budget-meals',
    categoryName: 'Budget Meals',
    price: 299,
    description: 'Margherita Pizza + 2 Cold Drinks combo meal.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80',
    badge: 'Date Special',
    featured: true
  },
  {
    id: 'combo-maggi-magic',
    name: 'Maggi Magic',
    category: 'budget-meals',
    categoryName: 'Budget Meals',
    price: 199,
    description: 'Vegetable Maggi + Cold Coffee + Salted French Fries combo meal.',
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=700&q=80',
    badge: 'All-in-One',
    featured: false
  },

  // ---------------------------------------------------------------------------
  // 14. ADD-ONS
  // ---------------------------------------------------------------------------
  {
    id: 'addon-black-chocochips',
    name: 'Black Chocochips',
    category: 'add-ons',
    categoryName: 'Add-Ons',
    price: 29,
    description: 'Extra scoop of crunchy dark chocolate chips.',
    image: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=700&q=80',
    badge: 'Add-On',
    featured: false
  },
  {
    id: 'addon-white-chocochips',
    name: 'White Chocochips',
    category: 'add-ons',
    categoryName: 'Add-Ons',
    price: 29,
    description: 'Extra scoop of sweet creamy white chocolate chips.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Add-On',
    featured: false
  },
  {
    id: 'addon-oreo-crumbles',
    name: 'Oreo Crumbles',
    category: 'add-ons',
    categoryName: 'Add-Ons',
    price: 10,
    description: 'Freshly crushed chocolate Oreo cookie topping.',
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80',
    badge: 'Add-On',
    featured: false
  },
  {
    id: 'addon-kitkat-bits',
    name: 'Kitkat Bits',
    category: 'add-ons',
    categoryName: 'Add-Ons',
    price: 30,
    description: 'Crispy crushed KitKat wafer bites.',
    image: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=700&q=80',
    badge: 'Add-On',
    featured: false
  },
  {
    id: 'addon-vanilla-ice-cream',
    name: 'Vanilla Ice Cream',
    category: 'add-ons',
    categoryName: 'Add-Ons',
    price: 30,
    description: 'Single scoop of rich creamy vanilla bean ice cream.',
    image: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=700&q=80',
    badge: 'Add-On',
    featured: false
  },
  {
    id: 'addon-chocolate-ice-cream',
    name: 'Chocolate Ice Cream',
    category: 'add-ons',
    categoryName: 'Add-Ons',
    price: 30,
    description: 'Single scoop of dense decadent chocolate ice cream.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Add-On',
    featured: false
  }
];

if (typeof module !== 'undefined') module.exports = MENU_ITEMS;
