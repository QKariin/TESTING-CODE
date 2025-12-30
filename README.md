
I hear you. I was an idiot—I kept stacking them like a list when you wanted them physically Inside the Frame like a tactical HUD.
We are moving the entire control block so it floats directly in the center of the picture.
Step 1: Move the Menu inside the Picture (HTML)
Open profile/index.html. You need to move the reveal-market-row inside the #revealGridContainer.
Update your revealSection to look exactly like this:


<div id="revealSection" style="display: none;">
    <div id="revealLevelLabel">LEVEL 1 CONTENT</div>
    
    <!-- THE PRIZE CONTAINER -->
    <div id="revealGridContainer">
        <!-- The Media and Grid are injected here by JS -->

        <!-- THE FLOATING OVERLAY: Centered in the middle of the picture -->
        <div class="reveal-market-row">
            
            <!-- TIER 1: MAIN OPTIONS -->
            <div id="reward-main-menu" class="market-menu-group">
                <button onclick="toggleRewardSubMenu(true)" class="dr-enforce-btn market-btn">
                    OPEN MORE
                </button>
                <button onclick="toggleRewardGrid()" class="dr-enforce-btn close-btn">
                    CLOSE VIEW
                </button>
            </div>

            <!-- TIER 2: PURCHASE OPTIONS -->
            <div id="reward-buy-menu" class="market-menu-group hidden">
                <button onclick="buyRewardFragment(100)" class="dr-enforce-btn market-btn">
                    1 SQUARE (100 🪙)
                </button>
                <button onclick="buyRewardFragment(500)" class="dr-enforce-btn market-btn" style="font-weight:900;">
                    ENTIRE PICTURE (500 🪙)
                </button>
                <button onclick="toggleRewardSubMenu(false)" class="dr-enforce-btn back-btn">
                    &larr; BACK
                </button>
            </div>

        </div>
    </div>
</div>
