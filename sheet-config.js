const CHRONICLE_SHEET_IDS = Object.freeze({
  유형설명: 1805815581, 패키지: 1965822688, 카테고리: 201117005, 사건: 201117001,
  주체: 201117003, 직위: 1685936172, 재임: 201117004, 사건_주체: 201117006, 관계: 201117008,
  사건_카테고리: 1859891208, 사건_패키지: 1675177887,
  공간: 201117010, 영토변화: 201117011, 사건_공간: 201117012, 지도도형: 201117013, 지도뷰: 201117014,
  주체_공간: 1813628837, 카테고리_공간: 1456709406
});
const SHEET_CONFIG = Object.freeze({
  id: '1n3NFzBPos-c4QKu8r1UE3QwOngd0vK5Vf4pEXhnxGE0',
  sheetIds: CHRONICLE_SHEET_IDS,
  eventSheetId: CHRONICLE_SHEET_IDS.사건,
  packageSheetId: CHRONICLE_SHEET_IDS.패키지,
  categorySheetId: CHRONICLE_SHEET_IDS.카테고리,
  relationSheetId: CHRONICLE_SHEET_IDS.관계,
  spaceSheetId: CHRONICLE_SHEET_IDS.공간,
  eventSpaceSheetId: CHRONICLE_SHEET_IDS.사건_공간,
  mapShapeSheetId: CHRONICLE_SHEET_IDS.지도도형,
  url: 'https://docs.google.com/spreadsheets/d/1n3NFzBPos-c4QKu8r1UE3QwOngd0vK5Vf4pEXhnxGE0/edit#gid=201117001',
  feedUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1eX3_Q-cCT5zz2BN4F5VMVIsMXAlGp99lWBEc-wyGeEz73i37QV6dVC9WsKJWjkKo3DQt1_-KLWob/pub?gid=734217007&single=true&output=csv'
});

const SHEET_MEDIA = Object.freeze({
  "https://drive.google.com/file/d/1BNWUxlYUxKTYtGvgb3F8k49pctAflQlD/view?usp=drivesdk": "/assets/notion-images/8bf417b3-777f-4264-b4f1-3a235689ba94.png",
  "https://drive.google.com/file/d/1rWgnd_pwC44jjYJlV2WFhCgmh1Fu4mG7/view?usp=drivesdk": "/assets/notion-images/5ac0c706-e6f5-4cfc-8828-c9949ebf9776.png",
  "https://drive.google.com/file/d/1fLjIWDZTFCf2UWYe5PYz0Txu2U9Kw8XD/view?usp=drivesdk": "/assets/notion-images/2d692c65-7476-4208-9dda-aeaab01e034e.png",
  "https://drive.google.com/file/d/1byAsv-FARDNo-_kq7Opni-x9EfW-XzTb/view?usp=drivesdk": "/assets/notion-images/d632ca3a-a474-4f58-baca-917c78708c91.png",
  "https://drive.google.com/file/d/1wRTop2KgI65jXG1LaEMQaF834mbUkpww/view?usp=drivesdk": "/assets/notion-images/a0c31aa5-4121-4fa6-a390-cd81c029b103.png",
  "https://drive.google.com/file/d/1p8104Ex4ZuRiIM3o80XS67QFnLzw-8iJ/view?usp=drivesdk": "/assets/notion-images/a3d33d9d-bc1b-42c7-96be-2c769c3894a1.png",
  "https://drive.google.com/file/d/1wit2CUXuXCuFkxkz76Kk_c6khpyOdXvt/view?usp=drivesdk": "/assets/notion-images/b45dd51b-6c2f-4296-922c-ac2a5d83596d.png",
  "https://drive.google.com/file/d/1GIYZnkj8yOlNgDqIlFysEfGYR4RnKxgq/view?usp=drivesdk": "/assets/notion-images/2e685dd6-f9ca-4209-8652-4bc3b4ddc036.png",
  "https://drive.google.com/file/d/1OXLFfSGEbVG7Vmf5mEt2tt5WaFM6XrG9/view?usp=drivesdk": "/assets/notion-images/478a1692-a937-41e1-b073-1b7b3ecc82a0.png",
  "https://drive.google.com/file/d/1pxPvc2JzP-51lxKdc8qw80sBQUCKkM6i/view?usp=drivesdk": "/assets/notion-images/25f7a15b-9bc3-4422-ada9-5b8c484eedab.png",
  "https://drive.google.com/file/d/11dxVE20PV5hpbpvd3564lP0GQKIMTMj3/view?usp=drivesdk": "/assets/notion-images/87860460-38c6-4c68-892a-e28d4d8837d9.png",
  "https://drive.google.com/file/d/17rUKRvCOfIQ630xSXDn5vCptwdAx_Ma3/view?usp=drivesdk": "/assets/notion-images/89eb773b-1924-4ed4-b9a6-62e1096634af.png",
  "https://drive.google.com/file/d/1tbpQII_TH89R4xdxN0DNY6TOFA8VA9ID/view?usp=drivesdk": "/assets/notion-images/ecd542c8-d50e-41c5-bec9-3c0d98cb0ce2.png",
  "https://drive.google.com/file/d/1fOTI0oiVFGZLS1sSLL3pnWCks7iCpi-o/view?usp=drivesdk": "/assets/notion-images/f1752dce-868f-4895-9186-00a07bc17e56.png",
  "https://drive.google.com/file/d/189gZBh9b2EX_nh6y2lV8eTBdxGhkrho-/view?usp=drivesdk": "/assets/notion-images/d6d0c50b-ba15-443f-a475-880eed5312ba.png",
  "https://drive.google.com/file/d/1IYEYDFMxhRK0VhpOKvg7fFxpF5xbFNHK/view?usp=drivesdk": "/assets/notion-images/bd5602a7-30ca-481b-bc7d-9d90455ea1f2.png",
  "https://drive.google.com/file/d/1F7hhu4f7cmae1q3dy9iRqBpM81UpWx2H/view?usp=drivesdk": "/assets/notion-images/5bbdf0cd-d146-4bf0-b29a-6c73764474e7.png",
  "https://drive.google.com/file/d/1MLXkL9zJLrl2ZVMJ9gfknCBSGiPg3spY/view?usp=drivesdk": "/assets/notion-images/638f620d-a632-45f3-95af-735d3503139d.png",
  "https://drive.google.com/file/d/1MCua0BA79xJYHzm6o_N8XHBW2JIcMQgG/view?usp=drivesdk": "/assets/notion-images/7430823e-e0ac-4721-9347-a2d596a1c351.png",
  "https://drive.google.com/file/d/1rg3bnaRKBVYSlafow-_yBWzdKf5uzzph/view?usp=drivesdk": "/assets/notion-images/135ebda8-344e-4650-b713-68b67f1941a1.png",
  "https://commons.wikimedia.org/wiki/File:Soviet_tank_in_Budapest_1956.jpg": "/assets/timeline-images/E048-01.webp",
  "https://commons.wikimedia.org/wiki/File:Fidel_Castro%27s_entry_into_Havana,_1959.jpg": "/assets/timeline-images/E050-01.webp",
  "https://commons.wikimedia.org/wiki/File:2506-landing_(1).jpg": "/assets/timeline-images/E053-01.webp",
  "https://commons.wikimedia.org/wiki/File:Cholon_after_Tet_Offensive_operations_1968.jpg": "/assets/timeline-images/E069-01.webp",
  "https://commons.wikimedia.org/wiki/File:Nixon_Contact_Sheet_WHPO-E3397_(cropped_02).jpg": "/assets/timeline-images/E097-01.webp",
  "https://commons.wikimedia.org/wiki/File:RIAN_archive_848095_Signing_the_Agreement_to_eliminate_the_USSR_and_establish_the_Commonwealth_of_Independent_States.jpg": "/assets/timeline-images/E164-01.webp",
  "https://commons.wikimedia.org/wiki/File:(Red_Cross_pamphlet_on_March_1st_Movement)_(KADA-shyun15-012~18).jpg": "/assets/timeline-images/E248-01.webp",
  "https://commons.wikimedia.org/wiki/File:Hangeul_hakhoe_Korean_Language_Society_20180915_130120.jpg": "/assets/timeline-images/E264-01.webp",
  "https://commons.wikimedia.org/wiki/File:Eom_In-seop_and_Hong_Beom-do.jpg": "/assets/timeline-images/E278-01.webp",
  "https://commons.wikimedia.org/wiki/File:%E9%87%91%E4%BD%90%E9%95%87.JPG": "/assets/timeline-images/E279-01.webp",
  "https://commons.wikimedia.org/wiki/File:Taegeukgi_in_Provisional_Government_of_ROK,_Shanghai.JPG": "/assets/timeline-images/E306-01.webp",
  "https://commons.wikimedia.org/wiki/File:SoldiersWWI.jpg": "/assets/timeline-images/E308-01.webp",
  "https://commons.wikimedia.org/wiki/File:Seoul_Station_in_1945.8.15.jpg": "/assets/timeline-images/E315-01.webp"
});

const TIMELINE_IMAGE_CREDITS = Object.freeze({
  "/assets/timeline-images/E164-01.webp": {
    "by": "RIA Novosti archive, image #848095 / U. Ivanov",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "/assets/timeline-images/E264-01.webp": {
    "by": "Hangeul hakhoe Korean Language Society 20180915 130120.jpg · LERK / Wikimedia Commons",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  "/assets/timeline-images/E306-01.webp": {
    "by": "Ericmetro / Wikimedia Commons",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  }
});

const TimelineImage = Object.freeze({
  src(url, media = SHEET_MEDIA) {
    if (!url) return '';
    if (Object.hasOwn(media, url)) return media[url];
    if (/^https?:\/\/(?:commons\.wikimedia\.org\/wiki\/File:|drive\.google\.com\/file\/d\/)/i.test(url)) return '';
    return /^(https?:\/\/|\/(?![\/\\]))/i.test(url) ? url : '';
  },
  credit(src) {
    return Object.hasOwn(TIMELINE_IMAGE_CREDITS, src) ? TIMELINE_IMAGE_CREDITS[src] : undefined;
  }
});
