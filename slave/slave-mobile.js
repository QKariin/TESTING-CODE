(function(win){
  // Common header generator
  function makeHeader(title, subtitle, closeCallback){
    return `
      <div class="mob-chat-header" style="flex-shrink: 0; width: 100%; justify-content: space-between; border-bottom: 1px solid #333; background: #000; padding: 0 15px; z-index: 50;">
        <div class="chat-queen-profile">
          <div class="queen-av-wrap">
            <img src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" class="queen-av-img">
            <div class="status-dot online"></div>
          </div>
          <div class="chat-meta-col">
            <div class="chat-queen-name">${title}</div>
            <div class="chat-status-text" style="color: #c5a059;">${subtitle}</div>
          </div>
        </div>
        <button onclick="${closeCallback}" style="background: none; border: none; color: #444; font-size: 2rem; line-height: 1; cursor: pointer; padding: 0;">×</button>
      </div>
    `;
  }

  // Common footer spacer
  function makeFooter(){
    return '<div style="height: 120px;"></div>';
  }

  // Render Home View
  function renderMobileHome(){
    return `
    <div id="viewMobileHome" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; padding: 0; z-index: 1;">
      <div class="mob-bg-layer">
        <img id="mob_bgPic" src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" class="bg-blur">
        <div class="bg-overlay"></div>
      </div>

      <div class="mob-hud-row">
                <div class="hud-circle slave" onclick="openLobby()">
                    <img src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png">
                    <div class="hud-gear">⚙</div>
                </div>
                <div class="hud-circle queen" onclick="openQueenMenu()">
                    <img id="hudSlavePic" src="">
                    <div id="hudDomStatus" class="hud-status-dot offline"></div>
                </div>
            </div>

            <div id="lobbyOverlay" class="mob-reward-overlay hidden">
                <div class="mob-reward-card lobby-card">
                    <div id="lobbyMenu" class="lobby-content">
                        <button class="lobby-btn" onclick="showLobbyAction('name')">ADD YOUR NAME</button>
                        <button class="lobby-btn" onclick="showLobbyAction('photo')">UPLOAD PHOTO</button>
                        <button class="lobby-btn" onclick="showLobbyAction('routine')">GET ROUTINE</button>
                        <button class="lobby-btn" onclick="showLobbyAction('kinks')">ADD KINKS</button>
                        <button class="lobby-btn" onclick="showLobbyAction('limits')">ADD LIMITS</button>
                        <div class="lobby-divider"></div>
                        <button class="lobby-btn close" onclick="closeLobby()">CLOSE</button>
                    </div>

                    <div id="lobbyActionView" class="lobby-content hidden">
                        <div id="lobbyPrompt" class="lobby-prompt">...</div>
                        <input type="text" id="lobbyInputText" class="lobby-input hidden" placeholder="Type here...">
                        <button id="lobbyInputFileBtn" class="lobby-file-btn hidden" onclick="document.getElementById('lobbyFile').click()">PICK PHOTO</button>
                        <input type="file" id="lobbyFile" hidden onchange="document.getElementById('lobbyInputFileBtn').innerText = 'PHOTO UPLOADED'">

                        <div id="routineSelectionArea" class="hidden" style="width:100%; display:flex; flex-direction:column; gap:10px;">
                            <div class="lobby-label" style="font-size:0.6rem; color:#888;">SELECT PROTOCOL:</div>
                            <div class="routine-grid">
                                <div class="routine-tile" onclick="selectRoutineItem(this, 'Morning Kneel')">Morning Kneel</div>
                                <div class="routine-tile" onclick="selectRoutineItem(this, 'Chastity Check')">Chastity Check</div>
                                <div class="routine-tile" onclick="selectRoutineItem(this, 'Cleanliness Check')">Cleanliness Check</div>
                                <div class="routine-tile special" onclick="selectRoutineItem(this, 'custom')">CREATE OWN (+1000)</div>
                            </div>
                            <input type="text" id="routineCustomInput" class="lobby-input hidden" placeholder="Describe your routine..." style="margin-top:10px;">
                        </div>

                        <div id="kinkSelectionArea" class="hidden" style="width:100%; display:flex; flex-direction:column; gap:10px;">
                             <div class="lobby-label" style="font-size:0.6rem; color:#888;">SELECT INTERESTS (100 EACH):</div>
                             <div id="kinkGrid" class="routine-grid"></div>
                        </div>

                        <div class="lobby-cost-area">
                            <span class="cost-lbl">COST:</span>
                            <span id="lobbyCostDisplay" class="cost-val">0</span>
                        </div>

                        <button id="btnLobbyConfirm" class="lobby-btn gold" onclick="confirmLobbyAction()">SUBMIT</button>
                        <button class="lobby-btn close" onclick="backToLobbyMenu()">BACK</button>
                    </div>
                </div>
            </div>

            <!-- QUEEN'S DUTY MENU -->
            <div id="queenOverlay" class="mob-reward-overlay hidden">
                <div class="mob-reward-card queen-card-layout">
                    ${makeHeader('DAILY DUTIES', '--/--/--', 'closeQueenMenu()')}

                    <div class="qm-scroll-content">
                        <div class="luxury-wrap">
                            <div class="luxury-card">
                                <div class="duty-label">PROTOCOL</div>
                                <div id="mobRoutineDisplay" style="font-family:'Cinzel'; font-size:1.1rem; color:#fff; margin-bottom:10px; line-height:1.4; text-align:center; text-shadow:0 0 10px rgba(255,255,255,0.1);">LOADING...</div>
                                <div style="text-align:center;">
                                    <div id="routineTimeMsg" class="txt-status-gold hidden">🔒 LOCKED UNTIL 07:00</div>
                                    <div id="routineDoneMsg" class="txt-status-green hidden">✔ EVIDENCE SUBMITTED</div>
                                </div>
                                <div style="display:flex; justify-content:center; margin-top:10px;">
                                    <button id="btnRoutineUpload" class="btn-upload-sm hidden" style="width:100%;" onclick="document.getElementById('routineUpload').click()">UPLOAD EVIDENCE</button>
                                </div>
                                <input type="file" id="routineUpload" hidden onchange="window.handleRoutineUpload(this)">
                            </div>

                            <div class="luxury-card">
                                <div class="duty-label">LABOR</div>
                                <div id="qm_TaskIdle" class="hidden">
                                    <div class="txt-status-red" style="margin-bottom:15px; font-size: 0.9rem; text-align:center;">UNPRODUCTIVE</div>
                                    <button class="lobby-btn" style="width:100%;" onclick="window.mobileRequestTask()">REQUEST TASK</button>
                                </div>
                                <div id="qm_TaskActive" class="hidden">
                                    <div class="txt-status-green" style="margin-bottom:10px; font-size: 0.9rem; text-align:center;">WORKING</div>
                                    <div id="mobTaskText">LOADING ORDERS...</div>
                                    <div class="card-timer-row">
                                        <div id="qm_timerH" class="card-t-box">00</div>
                                        <div style="color:#444; font-size:1.2rem;">:</div>
                                        <div id="qm_timerM" class="card-t-box">00</div>
                                        <div style="color:#444; font-size:1.2rem;">:</div>
                                        <div id="qm_timerS" class="card-t-box">00</div>
                                    </div>
                                    <div style="display:flex; gap:10px; margin-top: 15px;">
                                       <button id="mobBtnUpload" class="btn-upload-sm" style="flex:1;" onclick="document.getElementById('evidenceInputMob').click()">UPLOAD</button>
                                        <input type="file" id="evidenceInputMob" hidden onchange="window.mobileUploadEvidence(this)">
                                       <button class="btn-skip-sm" style="flex:1;" onclick="window.mobileSkipTask()">Failure (-300 coins)</button>
                                    </div>
                                </div>
                            </div>

                            <div class="luxury-card">
                                <div class="duty-label">KNEELING GOAL</div>
                                <div class="kneel-track-reverted">
                                    <div id="kneelDailyFill" class="kneel-fill-reverted"></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-top:10px; padding:0 5px;">
                                    <span style="font-family:'Orbitron'; font-size:0.6rem; color:#666;">DAILY TARGET</span>
                                    <span id="kneelDailyText" style="font-family:'Orbitron'; font-size:0.8rem; color:#fff;">0 / 8</span>
                                </div>
                            </div>

                            <button class="lobby-btn close" style="margin-top:10px; border-color: #333; color: #666;" onclick="closeQueenMenu()">CLOSE CARD</button>
                            <div style="height: 60px;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="mobHomeScroll" style="flex: 1; width: 100%; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 60px 20px 120px 20px; -webkit-overflow-scrolling: touch; box-sizing: border-box;">
                <div class="halo-section">
                    <div class="halo-ring">
                        <div id="mob_slaveName" class="halo-name">SLAVE</div>
                        <div id="mob_rankStamp" class="halo-rank">INITIATE</div>
                        <div class="mob-section-wrapper" style="width:100%;">
                            <div class="mob-grid-label-center">DAILY PROGRESS</div>
                            <div id="mob_streakGrid" class="mob-streak-strip"></div>
                        </div>
                    </div>
                </div>

                <div style="width:100%; display:flex; flex-direction:column; align-items:center; z-index:3;">
                    <div class="halo-stats-card">
                        <div class="h-stat"><span class="h-val" id="mobPoints">0</span><span class="h-lbl">MERIT</span></div>
                        <div class="h-divider"></div>
                        <div class="h-stat"><span class="h-val" id="mobCoins">0</span><span class="h-lbl">NET</span></div>
                    </div>

                    <div class="mob-stats-toggle-btn" onclick="toggleMobileStats()">SLAVE STATS <span id="mobStatsArrow">▼</span></div>

                    <div id="mobStatsContent" class="mob-internal-drawer">
                        <div class="drawer-row"><span class="d-lbl">CURRENT STREAK</span><span class="d-val" id="mobStreak">0</span></div>
                        <div class="drawer-row"><span class="d-lbl">TOTAL SERVED</span><span class="d-val" id="mobTotal">0</span></div>
                        <div class="drawer-row"><span class="d-lbl">KNEEL COUNT</span><span class="d-val" id="mobKneels">0</span></div>
                    </div>
                </div>

                <div class="halo-stack" style="padding: 0 20px; width:100%; margin-top:15px;">
                    <div class="mob-kneel-bar mob-kneel-zone" onmousedown="if(window.handleHoldStart) window.handleHoldStart(event)" onmouseup="if(window.handleHoldEnd) window.handleHoldEnd(event)" onmouseleave="if(window.handleHoldEnd) window.handleHoldEnd(event)" ontouchstart="if(window.handleHoldStart) window.handleHoldStart(event)" ontouchend="if(window.handleHoldEnd) window.handleHoldEnd(event)">
                        <div id="mob_kneelFill" class="mob-bar-fill"></div>
                        <div class="mob-bar-content">
                            <span class="kneel-icon-sm">◈</span>
                            <span id="mob_kneelText" class="kneel-text kneel-label">HOLD TO KNEEL</span>
                        </div>
                    </div>
                 </div>

                <div class="mob-section-wrapper" style="margin-top: 30px; width: 100%; padding-bottom: 20px;">
                    <div class="duty-label">SERVICE RECORD</div>
                    <div class="mob-grid-label-center" style="text-align: left; padding-left: 10px; color: #666;">HIERARCHY</div>
                    <div id="shelfRanks" class="reward-shelf mob-horiz-scroll"></div>
                    <div class="mob-grid-label-center" style="text-align: left; padding-left: 10px; color: #666; margin-top: 15px;">LABOR</div>
                    <div id="shelfTasks" class="reward-shelf mob-horiz-scroll"></div>
                    <div class="mob-grid-label-center" style="text-align: left; padding-left: 10px; color: #666; margin-top: 15px;">ENDURANCE</div>
                    <div id="shelfKneel" class="reward-shelf mob-horiz-scroll"></div>
                    <div class="mob-grid-label-center" style="text-align: left; padding-left: 10px; color: #666; margin-top: 15px;">SACRIFICE</div>
                    <div id="shelfSpend" class="reward-shelf mob-horiz-scroll"></div>
                </div>

                <div id="mobKneelReward" class="mob-reward-overlay hidden">
                    <div class="mob-reward-card">
                        <div class="mob-hex-wrap small-reward">
                            <div class="mob-rank-stamp" style="right: auto; left: -5px; color: #fff; border-color: #fff;">AUTHORIZED</div>
                        </div>
                        <h2 class="mob-reward-title">DEVOTION RECOGNIZED</h2>
                        <div class="mob-reward-actions">
                            <button onclick="window.claimKneelReward('coins')" class="mob-action-btn" style="border-color: #ffd700; color: #ffd700;">CLAIM COINS</button>
                            <button onclick="window.claimKneelReward('points')" class="mob-action-btn" style="border-color: #fff; color: #fff;">CLAIM MERIT</button>
                        </div>
                    </div>
                </div>
                ${makeFooter()}
            </div>
        </div>
    `;
  }

  // Render Record View
  function renderMobileRecord(){
    return `
    <div id="viewMobileRecord" class="mob-frame" style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh !important; overflow: hidden !important; flex-direction: column; padding: 0 !important; background: #000; z-index: 10;">
      ${makeHeader('SLAVE RECORD', 'OFFICIAL RECORD', "window.toggleMobileView('home')")}
      <div id="mobRecordScroll" style="flex: 1; overflow-y: auto; width: 100%; display: flex; flex-direction: column; justify-content: space-evenly; padding-top: 100px; padding-bottom: 80px; -webkit-overflow-scrolling: touch;">
        <div class="mob-altar-container">
          <div class="mob-grid-label-center">HIGHEST MERIT</div>
          <div class="mob-pyramid-stage">
            <div class="mob-idol side"><img id="mobRec_Slot2" src=""><div class="mob-rank-badge">II</div></div>
            <div class="mob-idol side right"><img id="mobRec_Slot3" src=""><div class="mob-rank-badge">III</div></div>
            <div class="mob-idol center"><img id="mobRec_Slot1" src=""><div class="mob-rank-badge main">I</div></div>
          </div>
        </div>
        <div class="mob-section-wrapper" style="margin-top:0; align-items:flex-start; padding-left:20px;">
          <div class="mob-grid-label">ACCEPTED PROTOCOLS</div>
          <div id="mobRec_Grid" class="mob-horiz-scroll"></div>
        </div>
        <div class="mob-section-wrapper" style="margin-top:0; align-items:flex-start; padding-left:20px;">
          <div class="mob-grid-label" style="color:#ff003c;">DENIED / FAILED</div>
          <div id="mobRec_Heap" class="mob-horiz-scroll small"></div>
        </div>
      </div>
    </div>
    `;
  }

  // Render Global View
  function renderMobileGlobal(){
    return `
    <div id="viewMobileGlobal" class="mob-frame" style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh !important; overflow: hidden !important; flex-direction: column; padding: 0 !important; background: #000; z-index: 100;">
      <div class="mob-chat-header" style="flex-shrink: 0; width: 100%; justify-content: center; border-bottom: 1px solid #333; background: #000; padding: 15px 0; z-index: 50;">
        <div class="chat-queen-profile">
          <div class="queen-av-wrap" style="border:none;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
          <div class="chat-meta-col" style="align-items: center; text-align: center;">
            <div class="chat-queen-name">GLOBAL NETWORK</div>
            <div class="chat-status-text" style="color: #c5a059;">FINANCIAL ACCESS</div>
          </div>
        </div>
      </div>
      <div id="mobGlobalScroll" style="flex: 1; overflow-y: auto; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 30px; padding-top: 100px; padding-bottom: 100px; -webkit-overflow-scrolling: touch;">
        <div style="width: 90%;">
          <button class="wallet-btn" onclick="openExchequer()" style="background: rgba(20,20,20,0.8); border: 1px solid #c5a059; color: #c5a059; padding: 20px; font-size: 1.1rem; box-shadow: 0 0 15px rgba(197, 160, 89, 0.2);">FILL WALLET</button>
        </div>
        <div style="width: 90%; background: #111; border: 1px solid #333; padding: 20px; text-align: center; border-radius: 4px;">
          <div style="color:#888; font-size:0.7rem; margin-bottom:10px; font-family:'Orbitron';">PROTOCOL STATUS</div>
          <div style="font-family:'Cinzel'; font-size:1.1rem; color:#fff; letter-spacing: 2px;">OBEDIENCE IS MANDATORY</div>
          <div style="font-family:'Orbitron'; font-size:0.6rem; color:#00ff00; margin-top:10px; letter-spacing: 2px;">SERVER: ONLINE</div>
        </div>
      </div>
      <div id="mobExchequer" class="mob-reward-overlay hidden" style="z-index: 2147483640;">
        <div class="mob-reward-card lobby-card" style="border: 1px solid #c5a059;">
          <div class="lobby-header">
            <div class="lobby-title">EXCHEQUER</div>
            <div class="lobby-subtitle">ACQUIRE CAPITAL</div>
          </div>
          <div class="coin-grid">
            <div class="coin-tile" onclick="window.buyRealCoins(1000)"><div class="coin-amount">1,000</div><div class="coin-price">€10.00</div></div>
            <div class="coin-tile" onclick="window.buyRealCoins(5500)"><div class="coin-amount">5,500</div><div class="coin-price">€50.00</div></div>
            <div class="coin-tile" onclick="window.buyRealCoins(12000)"><div class="coin-amount">12,000</div><div class="coin-price">€100.00</div></div>
            <div class="coin-tile" onclick="window.buyRealCoins(30000)"><div class="coin-amount">30,000</div><div class="coin-price">€250.00</div></div>
            <div class="coin-tile" onclick="window.buyRealCoins(70000)"><div class="coin-amount">70,000</div><div class="coin-price">€500.00</div></div>
            <div class="coin-tile" onclick="window.buyRealCoins(150000)"><div class="coin-amount">150,000</div><div class="coin-price">€1000.00</div></div>
          </div>
          <button class="lobby-btn close" onclick="closeExchequer()" style="margin-top:20px;">CLOSE</button>
        </div>
      </div>
    </div>
    `;
  }

  // Render Poverty Overlay
  function renderPovertyOverlay(){
    return `
    <div id="povertyOverlay" class="mob-reward-overlay hidden">
      <div class="mob-reward-card" style="border-color: #ff003c; box-shadow: 0 0 30px rgba(255, 0, 60, 0.2);">
        <div class="mob-hex-wrap small-reward" style="background: linear-gradient(135deg, #ff003c, #000);">
          <div class="mob-rank-stamp" style="right: auto; left: -5px; color: #fff; border-color: #fff;">DENIED</div>
        </div>
        <h2 class="mob-reward-title" style="color:#ff003c;">INSUFFICIENT CAPITAL</h2>
        <div id="povertyInsult" style="font-family:'Cinzel'; color:#ccc; font-size:0.85rem; line-height:1.4; padding:0 10px;">You cannot afford my attention.</div>
        <div class="mob-reward-actions" style="margin-top:10px;">
          <button onclick="goToExchequer()" class="mob-action-btn" style="border-color: #ff003c; color: #ff003c;">BOOST WALLET</button>
          <button onclick="closePoverty()" class="mob-action-btn" style="border-color: #444; color: #888;">APOLOGIZE & RETURN</button>
        </div>
      </div>
    </div>
    `;
  }

  // Render Reward Card Overlay
  function renderRewardCardOverlay(){
    return `
    <div id="rewardCardOverlay" class="mob-reward-overlay hidden" onclick="closeRewardCard()">
      <div class="mob-reward-card" onclick="event.stopPropagation()">
        <div class="rc-header">
          <div id="rcIcon" class="rc-icon-large"></div>
          <div class="rc-meta">
            <div id="rcTitle" class="rc-title">TITLE</div>
            <div id="rcStatus" class="rc-status">LOCKED</div>
          </div>
        </div>
        <div id="rcQuote" class="rc-quote">"Obedience is the only currency."</div>
        <div class="rc-progress-wrap">
          <div class="rc-progress-labels">
            <span id="rcCurrent">0</span>
            <span id="rcTarget">/ 100</span>
          </div>
          <div class="rc-track">
            <div id="rcFill" class="rc-fill"></div>
          </div>
        </div>
        <button class="mob-action-btn" onclick="closeRewardCard()">ACKNOWLEDGE</button>
      </div>
    </div>
    `;
  }

  // Render Tribute Store Overlay
  function renderTributeStore(){
    return `
    <div id="tributeStoreOverlay" class="mob-frame" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh !important; overflow: hidden !important; flex-direction: column; padding: 0 !important; background: #000; z-index: 2147483647;">
      ${makeHeader('TRIBUTE STORE', 'SACRIFICE CAPITAL', "window.toggleTributeStore()")}
      <div id="tributeScrollArea" style="flex: 1; overflow-y: auto; width: 100%; padding: 20px; -webkit-overflow-scrolling: touch; padding-bottom: 100px;">
        <div id="tributeGridContent" class="store-grid-layout"></div>
      </div>
    </div>
    `;
  }

  // Main renderMobile function - injects base app container
  function renderMobile(target){
    if (!document) return null;
    var el = null;
    if (typeof target === 'string') el = document.getElementById(target) || document.querySelector(target);
    else el = target;
    if (!el) return null;
    if (el.__mobileRendered) return el;

    var html = `<div id="MOBILE_APP" style="display:none;"></div>`;
    el.innerHTML = html;
    el.__mobileRendered = true;
    return el;
  }

  // View injection helper - renders specific view into MOBILE_APP
  function renderView(viewName){
    var app = document.getElementById('MOBILE_APP');
    if (!app) return null;
    var content = '';
    switch(viewName){
      case 'home': content = renderMobileHome(); break;
      case 'record': content = renderMobileRecord(); break;
      case 'global': content = renderMobileGlobal(); break;
      case 'poverty': content = renderPovertyOverlay(); break;
      case 'reward': content = renderRewardCardOverlay(); break;
      case 'tribute': content = renderTributeStore(); break;
      default: return null;
    }
    app.innerHTML = content;
    return app;
  }

  // Expose to window
  win.renderMobile = renderMobile;
  win.renderView = renderView;
})(window);
