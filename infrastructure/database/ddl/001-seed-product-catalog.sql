-- 001-seed-product-catalog.sql
-- AEA / Lily's Florist
-- V001 Product Catalog controlled/static data

\set ON_ERROR_STOP on
\timing on
\echo '======================================================================'
\echo 'Artifact : 001-seed-product-catalog.sql'
SELECT clock_timestamp() AS artifact_started_at,
       'START 001-seed-product-catalog.sql' AS operation;

BEGIN;

INSERT INTO product_category (category_id, category_name, category_description, seasonal_flag) VALUES
('CAT001','Romantic','Products suited to romantic occasions and expressions of affection.',FALSE),
('CAT002','Anniversary','Products suited to celebrating anniversaries.',FALSE),
('CAT003','Birthday','Products suited to birthday celebrations.',FALSE),
('CAT004','Elegant','Refined products with an elegant presentation.',FALSE),
('CAT005','Pastel','Products featuring soft pastel colors and styling.',FALSE),
('CAT006','Get Well','Cheerful gifts appropriate for wishing someone a speedy recovery.',FALSE),
('CAT007','Sympathy','Thoughtful products appropriate for sympathy and remembrance.',FALSE),
('CAT008','Thank You','Products appropriate for expressing gratitude.',FALSE),
('CAT009','Luxury','Premium products and elevated gift experiences.',FALSE),
('CAT010','Modern','Products with contemporary styling and presentation.',FALSE),
('CAT011','Valentine''s Day','Products appropriate for Valentine''s Day gifting.',TRUE),
('CAT012','Mother''s Day','Products appropriate for Mother''s Day gifting.',TRUE),
('CAT013','Spring','Bright and fresh products associated with the spring season.',TRUE),
('CAT014','Congratulations','Products suited to celebrations and congratulations.',FALSE),
('CAT015','Housewarming','Products appropriate as gifts for a new home.',FALSE);

INSERT INTO product (product_id, product_name, product_short_description, product_long_description, product_thumbnail_reference, product_type) VALUES
('P001','Classic Red Rose Bouquet','A timeless bouquet of premium red roses.','A classic bouquet featuring twelve premium red roses arranged with fresh greenery and finished with an elegant wrap.','placeholder://classic-red-rose-bouquet','Bouquet'),
('P002','Blush Romance Bouquet','Soft pink blooms with a romantic modern feel.','A graceful bouquet of blush roses, lilies and complementary seasonal blooms designed for understated romance.','placeholder://blush-romance-bouquet','Bouquet'),
('P003','Spring Garden Basket','A cheerful mixed-flower basket inspired by spring.','A colorful basket arrangement featuring tulips, daisies, lilies and seasonal greenery in a reusable wicker basket.','placeholder://spring-garden-basket','Floral Arrangement'),
('P004','White Serenity Arrangement','An elegant white floral arrangement.','A calming arrangement of white lilies, roses and seasonal white blooms designed for thoughtful occasions and refined spaces.','placeholder://white-serenity-arrangement','Floral Arrangement'),
('P005','Sunflower Joy Bouquet','Bright sunflowers arranged for instant cheer.','A vibrant bouquet centered on fresh sunflowers with complementary greenery and cheerful seasonal accents.','placeholder://sunflower-joy-bouquet','Bouquet'),
('P006','Pastel Baby Celebration','Soft pastel flowers for a joyful celebration.','A gentle arrangement of pink, lavender, cream and pale yellow blooms presented in a soft contemporary style.','placeholder://pastel-baby-celebration','Floral Arrangement'),
('P007','Orchid Elegance','A sophisticated potted orchid for home or office.','A graceful live orchid presented in a contemporary planter, ideal for elegant gifting and lasting enjoyment.','placeholder://orchid-elegance','Plant'),
('P008','Modern Succulent Garden','A contemporary collection of easy-care succulents.','A curated assortment of succulents planted together in a modern low-profile container for home or office.','placeholder://modern-succulent-garden','Plant'),
('P009','Crystal Glass Vase','A versatile clear glass vase with a refined silhouette.','A clear glass vase designed to complement bouquets and floral arrangements while fitting traditional or modern decor.','placeholder://crystal-glass-vase','Vase'),
('P010','Rose-Tinted Keepsake Vase','A soft rose-colored vase for flowers or display.','A decorative rose-tinted glass vase designed as both a floral container and a lasting keepsake.','placeholder://rose-tinted-keepsake-vase','Vase'),
('P011','Belgian Chocolate Collection','An assorted box of premium Belgian chocolates.','A gift box containing sixteen assorted Belgian-style chocolates with a mix of rich, creamy and nutty flavors.','placeholder://belgian-chocolate-collection','Chocolate'),
('P012','Sweet Celebration Candy Box','A colorful assortment of classic sweets.','A festive gift box filled with individually wrapped candies selected for birthdays, congratulations and cheerful gifting.','placeholder://sweet-celebration-candy-box','Candy'),
('P013','Romance Gift Set','Flowers, chocolates and a keepsake gift in one set.','A complete romantic gift featuring a red rose bouquet, premium chocolate collection and small keepsake plush bear.','placeholder://romance-gift-set','Gift Set'),
('P014','Birthday Celebration Gift Set','A bright birthday-ready combination gift.','A cheerful gift set combining a colorful floral bouquet, candy box and festive birthday balloon.','placeholder://birthday-celebration-gift-set','Gift Set'),
('P015','Celebration Balloon Bundle','A festive bundle of five celebration balloons.','A coordinated set of five helium-style celebration balloons suitable for birthdays, congratulations and festive gifting.','placeholder://celebration-balloon-bundle','Balloon'),
('P016','Love You Balloon','A romantic statement balloon for a special delivery.','A large decorative love-themed balloon designed to accompany flowers, chocolates or a romantic gift set.','placeholder://love-you-balloon','Balloon'),
('P017','Lavender Fields Bouquet','Lavender and purple blooms with a relaxed garden style.','A fragrant-looking mix of lavender-toned seasonal flowers, roses and greenery arranged in a relaxed garden-inspired bouquet.','placeholder://lavender-fields-bouquet','Bouquet'),
('P018','Elegant Lily Vase Arrangement','Fresh lilies presented in a classic glass vase.','A polished arrangement of premium lilies and complementary greenery presented ready-to-display in a clear glass vase.','placeholder://elegant-lily-vase-arrangement','Floral Arrangement'),
('P019','Thank You Garden Bouquet','A colorful bouquet designed to express appreciation.','A welcoming mix of seasonal flowers in warm, cheerful tones created as an easy and thoughtful thank-you gift.','placeholder://thank-you-garden-bouquet','Bouquet'),
('P020','Luxury Rose and Orchid Arrangement','Premium roses and orchids in an elevated design.','A luxurious floral arrangement combining premium roses and orchids with sophisticated greenery in a modern presentation.','placeholder://luxury-rose-orchid-arrangement','Floral Arrangement'),
('P021','Spring Tulip Bouquet','Fresh colorful tulips celebrating the season.','A seasonal bouquet of eighteen mixed-color tulips wrapped simply to showcase their fresh spring character.','placeholder://spring-tulip-bouquet','Bouquet'),
('P022','Peaceful Memories Basket','A thoughtful white and green sympathy arrangement.','A tasteful basket of white flowers and soft greenery created for remembrance, sympathy and expressions of support.','placeholder://peaceful-memories-basket','Floral Arrangement'),
('P023','Housewarming Orchid and Chocolates','A lasting orchid paired with premium chocolates.','A housewarming gift pairing a potted orchid with an assorted premium chocolate collection for a polished welcome-home gesture.','placeholder://housewarming-orchid-chocolates','Gift Set'),
('P024','Pink Lily Vase Arrangement','Soft pink lilies arranged in a ready-to-display vase.','An elegant arrangement of pink lilies, complementary pastel blooms and greenery presented in a clear glass vase.','placeholder://pink-lily-vase-arrangement','Floral Arrangement'),
('P025','Seasonal Floral Surprise','A designer-selected arrangement using the best seasonal blooms.','A fresh arrangement created from attractive seasonal flowers selected by Lily for color, freshness and overall presentation.','placeholder://seasonal-floral-surprise','Floral Arrangement');

INSERT INTO product_price (product_id, product_price_usd) VALUES
('P001',79.99),('P002',89.99),('P003',109.99),('P004',99.99),('P005',59.99),
('P006',84.99),('P007',74.99),('P008',54.99),('P009',24.99),('P010',29.99),
('P011',34.99),('P012',24.99),('P013',149.99),('P014',119.99),('P015',39.99),
('P016',14.99),('P017',69.99),('P018',94.99),('P019',64.99),('P020',159.99),
('P021',74.99),('P022',114.99),('P023',109.99),('P024',125.00),('P025',79.99);

INSERT INTO product_inventory (product_id, quantity) VALUES
('P001',18),('P002',12),('P003',7),('P004',8),('P005',20),
('P006',10),('P007',9),('P008',14),('P009',25),('P010',16),
('P011',30),('P012',24),('P013',6),('P014',8),('P015',15),
('P016',22),('P017',11),('P018',9),('P019',13),('P020',4),
('P021',16),('P022',6),('P023',7),('P024',10),('P025',12);

INSERT INTO product_category_assignment (product_id, category_id) VALUES
('P001','CAT001'),('P001','CAT002'),('P001','CAT004'),('P001','CAT011'),
('P002','CAT001'),('P002','CAT002'),('P002','CAT005'),('P002','CAT010'),('P002','CAT011'),
('P003','CAT003'),('P003','CAT006'),('P003','CAT013'),
('P004','CAT004'),('P004','CAT007'),
('P005','CAT003'),('P005','CAT006'),('P005','CAT008'),
('P006','CAT005'),('P006','CAT014'),
('P007','CAT004'),('P007','CAT009'),('P007','CAT010'),('P007','CAT015'),
('P008','CAT010'),('P008','CAT015'),
('P009','CAT004'),('P009','CAT010'),('P009','CAT015'),
('P010','CAT001'),('P010','CAT005'),('P010','CAT004'),
('P011','CAT001'),('P011','CAT003'),('P011','CAT008'),('P011','CAT011'),
('P012','CAT003'),('P012','CAT008'),('P012','CAT014'),
('P013','CAT001'),('P013','CAT009'),('P013','CAT011'),
('P014','CAT003'),('P014','CAT014'),
('P015','CAT003'),('P015','CAT014'),
('P016','CAT001'),('P016','CAT011'),
('P017','CAT004'),('P017','CAT005'),('P017','CAT008'),
('P018','CAT004'),('P018','CAT008'),
('P019','CAT008'),('P019','CAT003'),
('P020','CAT001'),('P020','CAT002'),('P020','CAT004'),('P020','CAT009'),('P020','CAT011'),
('P021','CAT003'),('P021','CAT013'),
('P022','CAT007'),('P022','CAT004'),
('P023','CAT004'),('P023','CAT009'),('P023','CAT015'),
('P024','CAT001'),('P024','CAT004'),('P024','CAT005'),
('P025','CAT013'),('P025','CAT008');

COMMIT;

\echo '--- POST-OPERATION VALIDATION -----------------------------------------'
SELECT 'product' AS table_name, count(*) AS row_count FROM product
UNION ALL
SELECT 'product_price' AS table_name, count(*) AS row_count FROM product_price
UNION ALL
SELECT 'product_inventory' AS table_name, count(*) AS row_count FROM product_inventory
UNION ALL
SELECT 'product_category' AS table_name, count(*) AS row_count FROM product_category
UNION ALL
SELECT 'product_category_assignment' AS table_name, count(*) AS row_count FROM product_category_assignment;

SELECT clock_timestamp() AS artifact_completed_at,
       'SUCCESS 001-seed-product-catalog.sql' AS operation;
\echo '======================================================================'
