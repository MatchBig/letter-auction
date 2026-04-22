const WORDS = [
    "apple","angle","arena","beach","bread","brick","brown","candy","chair","cloud",
    "crane","crown","dance","dream","earth","eagle","flame","field","fruit","glass",
    "grape","green","heart","house","human","horse","lemon","light","magic","mango",
    "money","music","night","ocean","plant","plate","power","queen","quest","quiet",
    "river","robot","stone","storm","sugar","table","tiger","train","water","whale",
    "white","world","zebra","blaze","charm","clean","clear","crash","drive","enjoy",
    "fresh","giant","glove","happy","honor","image","laugh","lucky","metal","model",
    "noble","party","peace","piano","pride","prize","quick","radio","reach","rocky",
    "shine","shoot","smile","snake","sound","spice","sunny","sword","teeth","torch",
    "truck","unity","vivid","weird","wings","worry","youth"
  ];
  
  function getRandomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }