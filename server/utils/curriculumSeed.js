/**
 * KIIP Curriculum Seed Data
 * Covers all 7 KIIP levels: 0, 1, 2, 3, 4, 5-basic, 5-advanced
 */

module.exports = [
  // ─────────────────────────────────────────────
  // Level 0 — 기초 (Basic) — 15h
  // ─────────────────────────────────────────────
  {
    level: '0',
    levelName: { ko: '기초', en: 'Basic' },
    hours: 15,
    units: [
      { number: 1,  titleKo: '한글 모음',          titleEn: 'Korean Vowels',                  section: null, isReview: false },
      { number: 2,  titleKo: '한글 자음',          titleEn: 'Korean Consonants',               section: null, isReview: false },
      { number: 3,  titleKo: '받침 없는 글자',      titleEn: 'Syllables Without Final Consonant', section: null, isReview: false },
      { number: 4,  titleKo: '받침 있는 글자',      titleEn: 'Syllables With Final Consonant',   section: null, isReview: false },
      { number: 5,  titleKo: '이중 모음',          titleEn: 'Compound Vowels',                 section: null, isReview: false },
      { number: 6,  titleKo: '쌍자음',            titleEn: 'Double Consonants',               section: null, isReview: false },
      { number: 7,  titleKo: '기본 인사',          titleEn: 'Basic Greetings',                 section: null, isReview: false },
      { number: 8,  titleKo: '자기소개',           titleEn: 'Self-Introduction',               section: null, isReview: false },
      { number: 9,  titleKo: '숫자와 날짜',         titleEn: 'Numbers and Dates',               section: null, isReview: false },
      { number: 10, titleKo: '한글 읽기 연습',      titleEn: 'Hangul Reading Practice',         section: null, isReview: false },
    ],
  },

  // ─────────────────────────────────────────────
  // Level 1 — 초급 1 (Beginner 1) — 100h — 20 units
  // ─────────────────────────────────────────────
  {
    level: '1',
    levelName: { ko: '초급 1', en: 'Beginner 1' },
    hours: 100,
    units: [
      { number: 0,  titleKo: '준비: 한글',          titleEn: 'Preparation: Hangul',             section: null, isReview: false },
      { number: 1,  titleKo: '인사와 소개',          titleEn: 'Greetings and Introductions',     section: null, isReview: false },
      { number: 2,  titleKo: '사물',               titleEn: 'Basic Objects',                   section: null, isReview: false },
      { number: 3,  titleKo: '일상생활',            titleEn: 'Everyday Activities',             section: null, isReview: false },
      { number: 4,  titleKo: '장소',               titleEn: 'Places and Directions',           section: null, isReview: false },
      { number: 5,  titleKo: '날짜와 요일',          titleEn: 'Dates and Days',                  section: null, isReview: false },
      { number: 6,  titleKo: '하루 일과',           titleEn: 'Daily Schedule',                  section: null, isReview: false },
      { number: 7,  titleKo: '음식',               titleEn: 'Food and Ordering',               section: null, isReview: false },
      { number: 8,  titleKo: '쇼핑',               titleEn: 'Shopping',                        section: null, isReview: false },
      { number: 9,  titleKo: '주말',               titleEn: 'Weekend Activities',              section: null, isReview: false },
      { number: 10, titleKo: '종합 연습 1',          titleEn: 'General Practice 1',              section: null, isReview: true  },
      { number: 11, titleKo: '가족',               titleEn: 'Family and Relationships',        section: null, isReview: false },
      { number: 12, titleKo: '특별한 날',           titleEn: 'Special Days',                    section: null, isReview: false },
      { number: 13, titleKo: '휴가 계획',           titleEn: 'Vacation Plans',                  section: null, isReview: false },
      { number: 14, titleKo: '교통',               titleEn: 'Transportation',                  section: null, isReview: false },
      { number: 15, titleKo: '약속',               titleEn: 'Making Plans',                    section: null, isReview: false },
      { number: 16, titleKo: '날씨',               titleEn: 'Weather and Seasons',             section: null, isReview: false },
      { number: 17, titleKo: '병원',               titleEn: 'Health and Hospital',             section: null, isReview: false },
      { number: 18, titleKo: '공공장소',            titleEn: 'Public Spaces',                   section: null, isReview: false },
      { number: 19, titleKo: '한국 생활',           titleEn: 'Korean Life',                     section: null, isReview: false },
      { number: 20, titleKo: '종합 연습 2',          titleEn: 'General Practice 2',              section: null, isReview: true  },
    ],
  },

  // ─────────────────────────────────────────────
  // Level 2 — 초급 2 (Beginner 2) — 100h — 20 units
  // ─────────────────────────────────────────────
  {
    level: '2',
    levelName: { ko: '초급 2', en: 'Beginner 2' },
    hours: 100,
    units: [
      { number: 1,  titleKo: '어떤 영화를 좋아해요?',                   titleEn: 'What movie do you like?',                       section: null, isReview: false },
      { number: 2,  titleKo: '어제 산 지갑을 잃어버렸어요',              titleEn: 'Yesterday I lost the wallet I bought',          section: null, isReview: false },
      { number: 3,  titleKo: '일요일마다 대청소를 해요',                 titleEn: 'We clean up every Sunday',                     section: null, isReview: false },
      { number: 4,  titleKo: '수영할 수 있어요?',                       titleEn: 'Can you swim?',                                section: null, isReview: false },
      { number: 5,  titleKo: '운동을 하고 싶지만 시간이 없어요',          titleEn: 'I want to exercise but have no time',          section: null, isReview: false },
      { number: 6,  titleKo: '김치를 볶은 후에 물을 넣으세요',            titleEn: 'Add water after frying kimchi',                section: null, isReview: false },
      { number: 7,  titleKo: '일이 있어서 못 갔어요',                    titleEn: "I couldn't go because I was busy",             section: null, isReview: false },
      { number: 8,  titleKo: '오늘 밤에도 눈이 올 것 같아요',             titleEn: "I think it's going to snow tonight",           section: null, isReview: false },
      { number: 9,  titleKo: '친구들이 도와주기로 했어요',               titleEn: 'My friends decided to help me',                section: null, isReview: false },
      { number: 10, titleKo: '종합 연습 1',                            titleEn: 'General Practice 1',                           section: null, isReview: true  },
      { number: 11, titleKo: '외국인등록증을 신청하려고 하는데요',         titleEn: 'Applying for alien registration card',         section: null, isReview: false },
      { number: 12, titleKo: '한 번 갈아타야 돼요',                      titleEn: 'You need to transfer once',                    section: null, isReview: false },
      { number: 13, titleKo: '여행 상품 상담을 하고 있어요',              titleEn: 'Consulting about travel packages',             section: null, isReview: false },
      { number: 14, titleKo: '집들이에 갈 때 무슨 선물이 좋아요?',        titleEn: 'What gift for a housewarming?',                section: null, isReview: false },
      { number: 15, titleKo: '여기에서 사진을 찍어도 돼요?',              titleEn: 'May I take pictures here?',                   section: null, isReview: false },
      { number: 16, titleKo: '쉽게 친해질 수 있을까요?',                 titleEn: 'Can you make friends easily?',                 section: null, isReview: false },
      { number: 17, titleKo: '빨리 나으세요',                          titleEn: 'I hope you get well soon',                     section: null, isReview: false },
      { number: 18, titleKo: '선생님 말씀 잘 들어',                      titleEn: 'Listen to your teacher',                      section: null, isReview: false },
      { number: 19, titleKo: '말하기 대회에 나간 적이 있어요?',           titleEn: 'Have you been in a speech contest?',           section: null, isReview: false },
      { number: 20, titleKo: '종합 연습 2',                            titleEn: 'General Practice 2',                           section: null, isReview: true  },
    ],
  },

  // ─────────────────────────────────────────────
  // Level 3 — 중급 1 (Intermediate 1) — 100h — 20 units
  // ─────────────────────────────────────────────
  {
    level: '3',
    levelName: { ko: '중급 1', en: 'Intermediate 1' },
    hours: 100,
    units: [
      { number: 1,  titleKo: '대인 관계',           titleEn: 'Interpersonal Relationships',     section: null, isReview: false },
      { number: 2,  titleKo: '성격',               titleEn: 'Personality',                     section: null, isReview: false },
      { number: 3,  titleKo: '지역 복지 서비스',     titleEn: 'Local Welfare Services',          section: null, isReview: false },
      { number: 4,  titleKo: '교환과 환불',          titleEn: 'Exchange and Refund',             section: null, isReview: false },
      { number: 5,  titleKo: '소비와 절약',          titleEn: 'Consumption and Savings',         section: null, isReview: false },
      { number: 6,  titleKo: '주거 환경',           titleEn: 'Living Environment',              section: null, isReview: false },
      { number: 7,  titleKo: '문화생활',            titleEn: 'Cultural Life',                   section: null, isReview: false },
      { number: 8,  titleKo: '음식과 요리',          titleEn: 'Food and Cooking',                section: null, isReview: false },
      { number: 9,  titleKo: '고장과 수리',          titleEn: 'Breakdown and Repair',            section: null, isReview: false },
      { number: 10, titleKo: '종합 연습 1',          titleEn: 'General Practice 1',              section: null, isReview: true  },
      { number: 11, titleKo: '취업',               titleEn: 'Getting a Job',                   section: null, isReview: false },
      { number: 12, titleKo: '부동산',              titleEn: 'Real Estate',                     section: null, isReview: false },
      { number: 13, titleKo: '전통 명절',           titleEn: 'Traditional Korean Holidays',     section: null, isReview: false },
      { number: 14, titleKo: '직장 생활',           titleEn: 'Workplace Life',                  section: null, isReview: false },
      { number: 15, titleKo: '인터넷과 스마트폰',    titleEn: 'Internet and Smartphone',         section: null, isReview: false },
      { number: 16, titleKo: '고민과 상담',          titleEn: 'Concerns and Counseling',         section: null, isReview: false },
      { number: 17, titleKo: '기후와 날씨',          titleEn: 'Climate and Weather',             section: null, isReview: false },
      { number: 18, titleKo: '문화 체험과 경험',     titleEn: 'Cultural Experience',             section: null, isReview: false },
      { number: 19, titleKo: '이웃과 지역사회',      titleEn: 'Neighbors and Community',         section: null, isReview: false },
      { number: 20, titleKo: '종합 연습 2',          titleEn: 'General Practice 2',              section: null, isReview: true  },
    ],
  },

  // ─────────────────────────────────────────────
  // Level 4 — 중급 2 (Intermediate 2) — 100h — 20 units
  // ─────────────────────────────────────────────
  {
    level: '4',
    levelName: { ko: '중급 2', en: 'Intermediate 2' },
    hours: 100,
    units: [
      { number: 1,  titleKo: '결혼',               titleEn: 'Marriage',                                             section: null, isReview: false },
      { number: 2,  titleKo: '영화와 드라마',        titleEn: 'Movies and Drama',                                     section: null, isReview: false },
      { number: 3,  titleKo: '생활과 인터넷',        titleEn: 'Life and the Internet',                                section: null, isReview: false },
      { number: 4,  titleKo: '가족의 변화',          titleEn: 'Changes in Families',                                  section: null, isReview: false },
      { number: 5,  titleKo: '한국의 교육',          titleEn: 'Korean Education System',                              section: null, isReview: false },
      { number: 6,  titleKo: '문화 차이',           titleEn: 'Cultural Differences',                                 section: null, isReview: false },
      { number: 7,  titleKo: '직장 생활',           titleEn: 'Work Life',                                            section: null, isReview: false },
      { number: 8,  titleKo: '사건과 사고',          titleEn: 'Accidents and Incidents',                              section: null, isReview: false },
      { number: 9,  titleKo: '한국의 경제',          titleEn: "South Korea's Economy",                                section: null, isReview: false },
      { number: 10, titleKo: '종합 연습 1',          titleEn: 'General Practice 1',                                   section: null, isReview: true  },
      { number: 11, titleKo: '신문과 방송',          titleEn: 'Newspapers and Broadcasting',                          section: null, isReview: false },
      { number: 12, titleKo: '이민 생활',           titleEn: 'Immigration Life',                                     section: null, isReview: false },
      { number: 13, titleKo: '한국인의 사고방식',    titleEn: 'Korean Mindset',                                       section: null, isReview: false },
      { number: 14, titleKo: '꿈과 미래',           titleEn: 'Dream and Future',                                     section: null, isReview: false },
      { number: 15, titleKo: '한국의 선거',          titleEn: 'Korean Elections',                                     section: null, isReview: false },
      { number: 16, titleKo: '환경 보호',           titleEn: 'Environmental Protection',                             section: null, isReview: false },
      { number: 17, titleKo: '한국의 명소와 유적지', titleEn: 'Tourist Attractions and Historical Sites',             section: null, isReview: false },
      { number: 18, titleKo: '인구 변화',           titleEn: 'Population Changes',                                   section: null, isReview: false },
      { number: 19, titleKo: '법과 질서',           titleEn: 'Law and Order',                                        section: null, isReview: false },
      { number: 20, titleKo: '종합 연습 2',          titleEn: 'General Practice 2',                                   section: null, isReview: true  },
    ],
  },

  // ─────────────────────────────────────────────
  // Level 5 Basic — 한국사회이해 기본 — 70h — 50 units
  // ─────────────────────────────────────────────
  {
    level: '5-basic',
    levelName: { ko: '한국사회이해 기본', en: 'Korean Society Understanding — Basic' },
    hours: 70,
    units: [
      // 사회 (Society) — units 1–8
      { number: 1,  titleKo: '한국의 상징',           titleEn: 'Symbols of Korea',                         section: '사회', isReview: false },
      { number: 2,  titleKo: '한국의 가족',           titleEn: 'Korean Family',                            section: '사회', isReview: false },
      { number: 3,  titleKo: '한국의 일터',           titleEn: 'Workplace in Korea',                       section: '사회', isReview: false },
      { number: 4,  titleKo: '한국의 교통과 통신',    titleEn: 'Transportation and Communication',         section: '사회', isReview: false },
      { number: 5,  titleKo: '한국의 대중매체',       titleEn: 'Mass Media',                               section: '사회', isReview: false },
      { number: 6,  titleKo: '한국의 복지체계',       titleEn: 'Welfare System',                           section: '사회', isReview: false },
      { number: 7,  titleKo: '한국의 도시와 농촌',    titleEn: 'Urban and Rural Areas',                    section: '사회', isReview: false },
      { number: 8,  titleKo: '한국의 의료와 안전 생활', titleEn: 'Healthcare and Safety',                  section: '사회', isReview: false },

      // 교육 (Education) — units 9–12
      { number: 9,  titleKo: '한국의 보육제도',       titleEn: 'Childcare System',                         section: '교육', isReview: false },
      { number: 10, titleKo: '한국의 학교',           titleEn: 'Korean Schools',                           section: '교육', isReview: false },
      { number: 11, titleKo: '한국의 교육열',         titleEn: 'Educational Fervor',                       section: '교육', isReview: false },
      { number: 12, titleKo: '지역사회와 평생교육',   titleEn: 'Community and Lifelong Education',         section: '교육', isReview: false },

      // 문화 (Culture) — units 13–19
      { number: 13, titleKo: '한국의 전통 의식주',    titleEn: 'Traditional Food, Clothing, Housing',     section: '문화', isReview: false },
      { number: 14, titleKo: '한국의 명절',           titleEn: 'Korean Holidays',                          section: '문화', isReview: false },
      { number: 15, titleKo: '한국의 종교',           titleEn: 'Religion in Korea',                        section: '문화', isReview: false },
      { number: 16, titleKo: '한국의 주거 문화',      titleEn: 'Residential Culture',                      section: '문화', isReview: false },
      { number: 17, titleKo: '한국의 여러 가지 의례', titleEn: 'Various Ceremonies',                       section: '문화', isReview: false },
      { number: 18, titleKo: '한국의 대중문화',       titleEn: 'Popular Culture',                          section: '문화', isReview: false },
      { number: 19, titleKo: '한국의 전통 가치와 연고', titleEn: 'Traditional Values and Connections',     section: '문화', isReview: false },

      // 정치 (Politics) — units 20–24
      { number: 20, titleKo: '한국 정치와 민주주의의 발전', titleEn: 'Politics and Democracy',             section: '정치', isReview: false },
      { number: 21, titleKo: '한국의 정치제도',       titleEn: 'Political System',                         section: '정치', isReview: false },
      { number: 22, titleKo: '한국의 정부형태',       titleEn: 'Government Structure',                     section: '정치', isReview: false },
      { number: 23, titleKo: '한국의 정치과정',       titleEn: 'Political Process',                        section: '정치', isReview: false },
      { number: 24, titleKo: '한국의 국제관계',       titleEn: 'International Relations',                  section: '정치', isReview: false },

      // 경제 (Economy) — units 25–29
      { number: 25, titleKo: '경제 성장, 한강의 기적',             titleEn: 'Economic Growth, Miracle on the Han River', section: '경제', isReview: false },
      { number: 26, titleKo: '세계의 주역이 되고 있는 한국 경제',  titleEn: "Korea's Growing Global Role",              section: '경제', isReview: false },
      { number: 27, titleKo: '금융기관 이용하기',                  titleEn: 'Using Financial Institutions',             section: '경제', isReview: false },
      { number: 28, titleKo: '시장과 장보기',                      titleEn: 'Markets and Shopping',                     section: '경제', isReview: false },
      { number: 29, titleKo: '취업하기',                          titleEn: 'Employment',                               section: '경제', isReview: false },

      // 법 (Law) — units 30–36
      { number: 30, titleKo: '외국인의 권리와 의무',              titleEn: 'Rights and Duties of Foreigners',          section: '법', isReview: false },
      { number: 31, titleKo: '외국인의 정착과 참여를 위한 법과 제도', titleEn: 'Laws for Settlement',                 section: '법', isReview: false },
      { number: 32, titleKo: '대한민국 국민 되기',               titleEn: 'Becoming a Korean Citizen',                section: '법', isReview: false },
      { number: 33, titleKo: '한국의 법집행 및 분쟁 해결',        titleEn: 'Law Enforcement and Disputes',             section: '법', isReview: false },
      { number: 34, titleKo: '한국의 생활법률',                   titleEn: 'Daily Life Laws',                          section: '법', isReview: false },
      { number: 35, titleKo: '권리 침해에 대한 구제와 보호',       titleEn: 'Remedies for Rights Violations',           section: '법', isReview: false },
      { number: 36, titleKo: '준법의 중요성',                     titleEn: 'Importance of Law Compliance',             section: '법', isReview: false },

      // 역사 (History) — units 37–43
      { number: 37, titleKo: '한국의 역사 I',    titleEn: 'History I (Gojoseon)',          section: '역사', isReview: false },
      { number: 38, titleKo: '한국의 역사 II',   titleEn: 'History II (Three Kingdoms)',   section: '역사', isReview: false },
      { number: 39, titleKo: '한국의 역사 III',  titleEn: 'History III (Goryeo)',          section: '역사', isReview: false },
      { number: 40, titleKo: '한국의 역사 IV',   titleEn: 'History IV (Joseon)',           section: '역사', isReview: false },
      { number: 41, titleKo: '한국의 역사 V',    titleEn: 'History V (Late Joseon/Colonial)', section: '역사', isReview: false },
      { number: 42, titleKo: '한국의 인물사 I',  titleEn: 'Historical Figures I',          section: '역사', isReview: false },
      { number: 43, titleKo: '한국의 인물사 II', titleEn: 'Historical Figures II',         section: '역사', isReview: false },

      // 지리 (Geography) — units 44–50
      { number: 44, titleKo: '한국의 위치, 기후, 지형',          titleEn: 'Location, Climate, Topography',            section: '지리', isReview: false },
      { number: 45, titleKo: '한국의 중심부, 수도권',            titleEn: 'Capital Region',                           section: '지리', isReview: false },
      { number: 46, titleKo: '아름다운 자연경관의 강원, 충청',   titleEn: 'Gangwon and Chungcheong',                  section: '지리', isReview: false },
      { number: 47, titleKo: '지역경제의 중심, 경상, 전라, 제주', titleEn: 'Gyeongsang, Jeolla, Jeju',               section: '지리', isReview: false },
      { number: 48, titleKo: '지역마다 다른 관광명소와 축제',     titleEn: 'Regional Attractions and Festivals',       section: '지리', isReview: false },
      { number: 49, titleKo: '우리 삶을 풍요롭게 하는 지역사회 기관', titleEn: 'Community Institutions',              section: '지리', isReview: false },
      { number: 50, titleKo: '지역의 문제를 해결하기 위한 우리의 노력', titleEn: 'Efforts to Solve Regional Problems', section: '지리', isReview: false },
    ],
  },

  // ─────────────────────────────────────────────
  // Level 5 Advanced — 한국사회이해 심화 — 30h — 20 units
  // ─────────────────────────────────────────────
  {
    level: '5-advanced',
    levelName: { ko: '한국사회이해 심화', en: 'Korean Society Understanding — Advanced' },
    hours: 30,
    units: [
      // 헌법과 민주주의 (Constitution and Democracy) — units 1–5
      { number: 1,  titleKo: '대한민국 헌법의 기본 원리',         titleEn: 'Basic Principles of the Korean Constitution',   section: '헌법과 민주주의', isReview: false },
      { number: 2,  titleKo: '기본권의 종류와 내용',             titleEn: 'Types and Contents of Fundamental Rights',     section: '헌법과 민주주의', isReview: false },
      { number: 3,  titleKo: '민주주의의 발전과 헌정사',          titleEn: 'Development of Democracy and Constitutional History', section: '헌법과 민주주의', isReview: false },
      { number: 4,  titleKo: '권력분립과 견제와 균형',           titleEn: 'Separation of Powers and Checks and Balances', section: '헌법과 민주주의', isReview: false },
      { number: 5,  titleKo: '헌법재판소와 기본권 보호',          titleEn: 'Constitutional Court and Protection of Rights', section: '헌법과 민주주의', isReview: false },

      // 한국사회와 문화 (Korean Society and Culture) — units 6–10
      { number: 6,  titleKo: '현대 한국 사회의 변화',            titleEn: 'Changes in Modern Korean Society',             section: '한국사회와 문화', isReview: false },
      { number: 7,  titleKo: '한국의 다문화 사회',              titleEn: 'Multicultural Society in Korea',               section: '한국사회와 문화', isReview: false },
      { number: 8,  titleKo: '사회 통합과 공동체 의식',          titleEn: 'Social Integration and Community Awareness',   section: '한국사회와 문화', isReview: false },
      { number: 9,  titleKo: '한국의 문화유산과 세계문화유산',    titleEn: 'Korean Heritage and World Heritage',          section: '한국사회와 문화', isReview: false },
      { number: 10, titleKo: '한국의 경제와 사회 발전',          titleEn: 'Korean Economic and Social Development',       section: '한국사회와 문화', isReview: false },

      // 한국의 역사 (History of Korea) — units 11–15
      { number: 11, titleKo: '근대 한국의 형성과 일제강점기',     titleEn: 'Formation of Modern Korea and Japanese Colonial Period', section: '한국의 역사', isReview: false },
      { number: 12, titleKo: '대한민국 임시정부와 독립운동',      titleEn: 'Provisional Government and Independence Movement', section: '한국의 역사', isReview: false },
      { number: 13, titleKo: '광복과 대한민국 정부 수립',        titleEn: 'Liberation and Establishment of the Republic', section: '한국의 역사', isReview: false },
      { number: 14, titleKo: '한국전쟁과 분단의 역사',           titleEn: 'Korean War and History of Division',           section: '한국의 역사', isReview: false },
      { number: 15, titleKo: '경제 발전과 민주화 과정',          titleEn: 'Economic Development and Democratization',     section: '한국의 역사', isReview: false },

      // 시민의 권리와 의무 (Civic Rights and Duties) — units 16–20
      { number: 16, titleKo: '납세의 의무와 세금 제도',          titleEn: 'Duty to Pay Taxes and Tax System',             section: '시민의 권리와 의무', isReview: false },
      { number: 17, titleKo: '국방의 의무와 병역 제도',          titleEn: 'National Defense Duty and Military Service',   section: '시민의 권리와 의무', isReview: false },
      { number: 18, titleKo: '교육의 의무와 권리',               titleEn: 'Right and Duty to Education',                  section: '시민의 권리와 의무', isReview: false },
      { number: 19, titleKo: '선거권과 참정권',                  titleEn: 'Right to Vote and Political Participation',    section: '시민의 권리와 의무', isReview: false },
      { number: 20, titleKo: '사회적 약자 보호와 인권',           titleEn: 'Protection of Vulnerable Groups and Human Rights', section: '시민의 권리와 의무', isReview: false },
    ],
  },
];
