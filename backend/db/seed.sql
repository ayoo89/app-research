-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data — 40 French retail products for testing
-- Run: docker exec -i appproduit-postgres-primary-1 psql -U postgres -d product_search < backend/db/seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO products (id, name, "codeGold", brand, barcode, description, category, family, subcategory, images, "embeddingGenerated", metadata, "createdAt", "updatedAt")
VALUES

-- ART FLORAL / FLEURS ARTIFICIELLES
(gen_random_uuid(), 'Bouquet de roses artificielles rouges 12 tiges', 'CG-AF-001', 'FloraDecor', '3760001000011', 'Bouquet de 12 roses artificielles rouge vif, tiges longues 50 cm, aspect naturel soyeux', 'ART FLORAL', 'ART FLORAL', 'FLEUR ARTIFICIELLE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Couronne de Noël en branches de sapin vert', 'CG-AF-002', 'FloraDecor', '3760001000028', 'Couronne décorative diamètre 40 cm, branches de sapin artificiel dense, idéale pour porte ou table', 'ART FLORAL', 'ART FLORAL', 'COURONNE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Bouquet de lavande artificielle violette 3 tiges', 'CG-AF-003', 'NaturArt', '3760001000035', 'Tiges de lavande provence 45 cm, couleur violette intense, parfait pour composition champêtre', 'ART FLORAL', 'ART FLORAL', 'FLEUR ARTIFICIELLE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Orchidée artificielle blanche en pot céramique', 'CG-AF-004', 'GreenTouch', '3760001000042', 'Orchidée phalaenopsis artificielle 2 tiges, pot en céramique blanc mat, hauteur totale 65 cm', 'ART FLORAL', 'ART FLORAL', 'PLANTE ARTIFICIELLE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Branche de cerisier fleuri rose 90 cm', 'CG-AF-005', 'FloraDecor', '3760001000059', 'Branche de cerisier en fleurs artificielles roses, longueur 90 cm, pour vase ou composition', 'ART FLORAL', 'ART FLORAL', 'BRANCHE ARTIFICIELLE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Guirlande de feuilles tropicales vertes 180 cm', 'CG-AF-006', 'GreenTouch', '3760001000066', 'Guirlande décorative feuilles de monstera et palmier artificiel, longueur 180 cm', 'ART FLORAL', 'ART FLORAL', 'GUIRLANDE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Pivoine artificielle rose poudré grand format', 'CG-AF-007', 'NaturArt', '3760001000073', 'Pivoine artificielle tête Ø 14 cm, rose poudré délicat, tige 55 cm, finition premium', 'ART FLORAL', 'ART FLORAL', 'FLEUR ARTIFICIELLE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Arbre à bonbons décoratif 45 cm blanc', 'CG-AF-008', 'FloraDecor', '3760001000080', 'Arbre artificiel topiaire boule, hauteur 45 cm, pot inclus, idéal mariage et événements', 'ART FLORAL', 'ART FLORAL', 'ARBRE ARTIFICIEL', '[]', false, '{}', NOW(), NOW()),

-- DÉCO INTÉRIEURE
(gen_random_uuid(), 'Vase en verre soufflé ambre 30 cm', 'CG-DC-001', 'MaisonDeco', '3760002000011', 'Vase en verre soufflé bouche, couleur ambre, hauteur 30 cm, diamètre ouverture 8 cm', 'DÉCO', 'DÉCO INTÉRIEURE', 'VASE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Bougie parfumée vanille bourbon 200g', 'CG-DC-002', 'ScentHome', '3760002000028', 'Bougie en cire de soja naturelle, parfum vanille bourbon, durée combustion 45h, pot verre avec couvercle', 'DÉCO', 'DÉCO INTÉRIEURE', 'BOUGIE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Cadre photo bois naturel 20x30 cm', 'CG-DC-003', 'FrameArt', '3760002000035', 'Cadre photo en bois massif naturel non traité, format 20x30 cm, verre anti-reflet, pied et crochet inclus', 'DÉCO', 'DÉCO INTÉRIEURE', 'CADRE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Miroir rond doré métal Ø 60 cm', 'CG-DC-004', 'MaisonDeco', '3760002000042', 'Miroir mural rond, cadre en métal doré brossé, diamètre 60 cm, crochet mural inclus', 'DÉCO', 'DÉCO INTÉRIEURE', 'MIROIR', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Photophore en macramé coton naturel', 'CG-DC-005', 'BohoDecor', '3760002000059', 'Photophore suspendu en macramé coton naturel tressé à la main, pour bougie chauffe-plat', 'DÉCO', 'DÉCO INTÉRIEURE', 'PHOTOPHORE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Plateau en bois d''acacia 35x25 cm', 'CG-DC-006', 'WoodHome', '3760002000066', 'Plateau de service en bois acacia naturel huilé, poignées métal, 35x25 cm, bords arrondis', 'DÉCO', 'DÉCO INTÉRIEURE', 'PLATEAU', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Statuette éléphant résine dorée 18 cm', 'CG-DC-007', 'ArtDeco', '3760002000073', 'Figurine décorative éléphant en résine finition dorée antique, hauteur 18 cm, base bois', 'DÉCO', 'DÉCO INTÉRIEURE', 'STATUETTE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Horloge murale ronde métal noir Ø 50 cm', 'CG-DC-008', 'TimeDecor', '3760002000080', 'Horloge murale design industriel, cadre métal noir mat, Ø 50 cm, mécanisme silencieux, pile AA incluse', 'DÉCO', 'DÉCO INTÉRIEURE', 'HORLOGE', '[]', false, '{}', NOW(), NOW()),

-- TEXTILES MAISON
(gen_random_uuid(), 'Coussin velours bleu nuit 45x45 cm', 'CG-TX-001', 'TextilHome', '3760003000011', 'Coussin décoratif en velours côtelé bleu nuit, garnissage 100% polyester, fermeture zippée', 'TEXTILES', 'TEXTILES MAISON', 'COUSSIN', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Rideau voilage blanc lin 140x260 cm', 'CG-TX-002', 'LinenTouch', '3760003000028', 'Voilage en lin lavé naturel blanc cassé, dimensions 140x260 cm, tête à œillets inox, lavable 30°', 'TEXTILES', 'TEXTILES MAISON', 'RIDEAU', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Plaid en laine mérinos gris 130x180 cm', 'CG-TX-003', 'WoolBliss', '3760003000035', 'Plaid en laine mérinos extra-fine gris clair, dimensions 130x180 cm, bords frangés, douceur exceptionnelle', 'TEXTILES', 'TEXTILES MAISON', 'PLAID', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Nappe en coton imprimé provençal 150x250 cm', 'CG-TX-004', 'TextilHome', '3760003000042', 'Nappe rectangulaire 150x250 cm, coton 100%, motif Provence olives et lavande, lavable 40°', 'TEXTILES', 'TEXTILES MAISON', 'NAPPE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Tapis berbère laine naturelle 160x230 cm', 'CG-TX-005', 'MarocDecor', '3760003000059', 'Tapis artisanal style berbère, laine naturelle non teinte, 160x230 cm, motifs géométriques', 'TEXTILES', 'TEXTILES MAISON', 'TAPIS', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Serviette de table coton bio lot de 4', 'CG-TX-006', 'LinenTouch', '3760003000066', 'Lot de 4 serviettes de table 40x40 cm, coton bio certifié GOTS, blanc naturel, lavable 60°', 'TEXTILES', 'TEXTILES MAISON', 'SERVIETTE', '[]', false, '{}', NOW(), NOW()),

-- PAPETERIE
(gen_random_uuid(), 'Carnet pointillé A5 couverture rigide noire', 'CG-PA-001', 'NotePro', '3760004000011', 'Carnet bullet journal A5, 160 pages pointillées 90g/m², couverture rigide noire, élastique et marque-page', 'PAPETERIE', 'PAPETERIE', 'CARNET', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Stylo plume acier inoxydable rechargeable', 'CG-PA-002', 'PenCraft', '3760004000028', 'Stylo plume en acier inoxydable brossé, plume acier M, cartouches bleues incluses, écriture fluide', 'PAPETERIE', 'PAPETERIE', 'STYLO', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Bloc mémo repositionnable 75x75 mm 4 couleurs', 'CG-PA-003', 'NotePro', '3760004000035', 'Lot de 4 blocs mémo repositionnables 75x75 mm, 100 feuilles/bloc, couleurs pastel assorties', 'PAPETERIE', 'PAPETERIE', 'BLOC NOTE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Organiseur de bureau bambou 6 compartiments', 'CG-PA-004', 'EcoDesk', '3760004000042', 'Range-papiers en bambou naturel, 6 compartiments de tailles variées, format A4, finition laquée', 'PAPETERIE', 'PAPETERIE', 'ORGANISEUR', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Pochette plastique A4 transparente lot de 100', 'CG-PA-005', 'OfficeTop', '3760004000059', '100 pochettes plastiques A4 en polypropylène transparent, épaisseur 80 microns, ouverture en L', 'PAPETERIE', 'PAPETERIE', 'POCHETTE', '[]', false, '{}', NOW(), NOW()),

-- CUISINE
(gen_random_uuid(), 'Poêle anti-adhésive 28 cm induction tous feux', 'CG-CU-001', 'CookPro', '3760005000011', 'Poêle Ø 28 cm revêtement céramique anti-adhésif PFOA free, compatible induction, manche amovible inox', 'CUISINE', 'CUISINE', 'POÊLE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Couteau de chef lame 20 cm acier inox forgé', 'CG-CU-002', 'BladeSharp', '3760005000028', 'Couteau chef professionnel lame 20 cm acier inoxydable X50CrMoV15, manche ergonomique noir', 'CUISINE', 'CUISINE', 'COUTEAU', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Planche à découper bambou XL 45x30 cm', 'CG-CU-003', 'WoodHome', '3760005000035', 'Planche à découper en bambou massif, format XL 45x30 cm, rainure jus, pieds antidérapants', 'CUISINE', 'CUISINE', 'PLANCHE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Mixeur plongeant 800W 9 vitesses inox', 'CG-CU-004', 'KitchenPro', '3760005000042', 'Mixeur plongeant 800W, 9 vitesses + turbo, tige inox 20 cm, lames tranchantes titane, accessoires inclus', 'CUISINE', 'CUISINE', 'MIXEUR', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Boîte hermétique verre avec couvercle bambou set 3', 'CG-CU-005', 'FreshStore', '3760005000059', 'Set de 3 boîtes hermétiques en verre borosilicate, couvercles en bambou, 0.5L + 1L + 1.5L', 'CUISINE', 'CUISINE', 'BOÎTE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Cafetière à piston inox 1L 8 tasses', 'CG-CU-006', 'BrewTime', '3760005000066', 'Cafetière french press 1 litre, double paroi acier inoxydable, filtre inox à double maille, 8 tasses', 'CUISINE', 'CUISINE', 'CAFETIÈRE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Balance de cuisine digitale 5kg précision 1g', 'CG-CU-007', 'KitchenPro', '3760005000073', 'Balance électronique 5kg / 1g, écran LCD rétroéclairé, fonction tare, plateau inox amovible', 'CUISINE', 'CUISINE', 'BALANCE', '[]', false, '{}', NOW(), NOW()),

-- RANGEMENT & ORGANISATION
(gen_random_uuid(), 'Panier en osier naturel avec couvercle M', 'CG-RG-001', 'StoreCraft', '3760006000011', 'Panier de rangement en osier naturel tressé, taille M 35x25x20 cm, couvercle clipsable, poignées', 'RANGEMENT', 'RANGEMENT', 'PANIER', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Boîte de rangement tissu gris anthracite 30L', 'CG-RG-002', 'StoreCraft', '3760006000028', 'Boîte de rangement pliable en tissu polyester gris anthracite, 30 litres, poignées renforcées', 'RANGEMENT', 'RANGEMENT', 'BOÎTE RANGEMENT', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Étagère murale pin massif 80x20 cm naturel', 'CG-RG-003', 'WoodHome', '3760006000035', 'Étagère flottante en pin massif naturel, 80x20x2 cm, fixation invisible, charge max 15 kg', 'RANGEMENT', 'RANGEMENT', 'ÉTAGÈRE', '[]', false, '{}', NOW(), NOW()),

-- JARDIN & EXTÉRIEUR
(gen_random_uuid(), 'Pot en terre cuite émaillée bleu Ø 25 cm', 'CG-JD-001', 'TerraStyle', '3760007000011', 'Pot de fleurs en terre cuite émaillée bleu majorelle, Ø 25 cm, trou drainage, résistant gel -5°C', 'JARDIN', 'JARDIN', 'POT', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Lanterne solaire métal bronze IP44', 'CG-JD-002', 'SolarLight', '3760007000028', 'Lanterne solaire extérieure métal finition bronze, LED blanc chaud, autonomie 8h, IP44, Ø 15 cm H35 cm', 'JARDIN', 'JARDIN', 'LANTERNE', '[]', false, '{}', NOW(), NOW()),
(gen_random_uuid(), 'Tuteur bambou naturel 150 cm lot de 10', 'CG-JD-003', 'GreenGarden', '3760007000035', 'Lot de 10 tuteurs en bambou naturel traité, longueur 150 cm, Ø 10-12 mm, résistant et léger', 'JARDIN', 'JARDIN', 'TUTEUR', '[]', false, '{}', NOW(), NOW());
