const firebaseConfig = {
    apiKey: "AIzaSyAvviywFxU5-Ia23Hqsl_3ItrsxF6oYLqA",
    authDomain: "ctjh-84ffc.firebaseapp.com",
    projectId: "ctjh-84ffc",
    storageBucket: "ctjh-84ffc.appspot.com",
    messagingSenderId: "81707489957",
    appId: "1:81707489957:web:f8c441380b528d77018b4c",
    measurementId: "G-NM1KMK8HT9"
  };
  
        // 初始化 Firebase
        const app = firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        const storage = firebase.storage();

        // 全局變量來存儲當前用戶名
        let currentUsername = ''

        // 獲取當前用戶並顯示用戶名和頭像
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDoc = await db.collection('users').doc(user.displayName).get();
                const userData = userDoc.data();
                const username = userData ? (userData.username || user.displayName) : user.displayName;
                currentUsername = username; // 儲存到全局變量
                console.log("當前用戶名:", currentUsername); // 新增日志
                document.getElementById('usernameDisplay').textContent = username;
                
                const userAvatarElement = document.getElementById('userAvatar');
                if (userData && userData.avatarUrl) {
                    userAvatarElement.innerHTML = `<img src="${userData.avatarUrl}" alt="用戶頭像">`;
                } else {
                    userAvatarElement.textContent = username.charAt(0).toUpperCase();
                }

                // 添加點擊事件以更換頭像
                userAvatarElement.addEventListener('click', uploadAvatar);

                // 顯示未批准的留言
                showUnapprovedPosts();
            } else {
                window.location.href = 'index.html';
            }
        });

        // 修改查詢條件以使用 currentUsername
        async function showUnapprovedPosts() {
            const postsContainer = document.getElementById('postsContainer');
            postsContainer.innerHTML = '';

            try {
                const postsQuerySnapshot = await db.collection('posts')
                    .where('assignedUser', '==', currentUsername)
                    .get();

                if (postsQuerySnapshot.empty) {
                    postsContainer.innerHTML = '<p class="no-posts">沒有找到相關的留言。</p>';
                } else {
                    postsQuerySnapshot.forEach((doc) => {
                        const postData = doc.data();
                        if (!postData.approved) {
                            const postElement = document.createElement('div');
                            postElement.className = 'post-card';
                            postElement.setAttribute('data-id', doc.id);
                            postElement.innerHTML = `
                                <div class="post-header">
                                    <h3>匿名留言</h3>
                                    <span class="post-status ${postData.published ? 'published' : ''}">
                                        ${postData.published ? '已發布' : '待發布'}
                                    </span>
                                </div>
                                <div class="post-content">${postData.content}</div>
                                ${postData.mediaUrls ? postData.mediaUrls.map(url => {
                                    if (url.type === 'image') {
                                        return `<img src="${url.url}" alt="留言圖片" class="post-media">`;
                                    } else if (url.type === 'video') {
                                        return `<video controls class="post-media">
                                                    <source src="${url.url}" type="video/mp4">
                                                    您的瀏覽器不支持視頻標籤。
                                                </video>`;
                                    } else if (url.type === 'gif') {
                                        return `<img src="${url.url}" alt="留言GIF" class="post-media">`;
                                    }
                                }).join('') : ''}
                                <div class="post-actions">
                                    <button class="approve-btn" onclick="approvePost('${doc.id}', this)">批准</button>
                                    <button class="reject-btn" onclick="rejectPost('${doc.id}', this)">不批准</button>
                                    <button class="download-btn" onclick="downloadPostAsImage(this)">下載圖片</button>
                                </div>
                            `;
                            postsContainer.appendChild(postElement);
                        }
                    });
                }
            } catch (error) {
                console.error("獲取留言時出錯：", error);
                showNotification("載入留言失敗，請稍後再試。");
            }
        }

        // 顯示已批准的留言
        async function showApprovedPosts() {
            const postsContainer = document.getElementById('postsContainer');
            postsContainer.innerHTML = '';

            try {
                const postsQuerySnapshot = await db.collection('posts')
                    .where('assignedUser', '==', currentUsername)
                    .where('approved', '==', true)
                    .orderBy('createdAt', 'desc')
                    .get();

                if (postsQuerySnapshot.empty) {
                    postsContainer.innerHTML = '<p class="no-posts">沒有找到相關的留言。</p>';
                } else {
                    postsQuerySnapshot.forEach((doc) => {
                        const postData = doc.data();
                        const postElement = document.createElement('div');
                        postElement.className = 'post-card';
                        postElement.setAttribute('data-id', doc.id);
                        postElement.innerHTML = `
                            <div class="post-header">
                                <h3>匿名留言</h3>
                                <span class="post-status ${postData.published ? 'published' : ''}">
                                    ${postData.published ? '已發布' : '待發布'}
                                </span>
                            </div>
                            <div class="post-content">${postData.content}</div>
                            ${postData.mediaUrls ? postData.mediaUrls.map(url => {
                                if (url.type === 'image') {
                                    return `<img src="${url.url}" alt="留言圖片" class="post-media">`;
                                } else if (url.type === 'video') {
                                    return `<video controls class="post-media">
                                                <source src="${url.url}" type="video/mp4">
                                                您的瀏覽器不支持視頻標籤。
                                            </video>`;
                                } else if (url.type === 'gif') {
                                    return `<img src="${url.url}" alt="留言GIF" class="post-media">`;
                                }
                            }).join('') : ''}
                            <div class="post-actions">
                                <button class="download-btn" onclick="downloadPostAsImage(this)">下載圖片</button>
                            </div>
                        `;
                        postsContainer.appendChild(postElement);
                    });
                }
            } catch (error) {
                if (error.code === 'failed-precondition') {
                    console.error("查詢需要索引。您可以在此處創建它：", error.message);
                    showNotification("查詢需要索引。請檢查控制台日誌以獲取更多信息。");
                } else {
                    console.error("獲取留言時出錯：", error);
                    showNotification("載入留言失敗，請稍後再試。");
                }
            }
        }

        // 批准留言功能
        async function approvePost(postId, button) {
            try {
                await db.collection('posts').doc(postId).update({
                    approved: true
                });
                showNotification("留言已批准！");
                button.parentElement.parentElement.style.display = 'none';
            } catch (error) {
                console.error("批准留言時出錯：", error);
                showNotification("批准留言失敗，請稍後再試。");
            }
        }

        // 不批准留言功能
        async function rejectPost(postId, button) {
            try {
                await db.collection('posts').doc(postId).delete();
                showNotification("留言已不批准！");
                button.parentElement.parentElement.style.display = 'none';
            } catch (error) {
                console.error("不批准留言時出錯：", error);
                showNotification("不批准留言失敗，請稍後再試。");
            }
        }

        // 打開刪除模擬框
        function openDeleteModal() {
            const modal = document.getElementById('deleteModal');
            modal.style.display = 'block';
            loadPostsForDelete();
        }

        // 閉刪除模擬框
        function closeDeleteModal() {
            const modal = document.getElementById('deleteModal');
            modal.style.display = 'none';
        }

        // 加載留言到刪除模擬框
        async function loadPostsForDelete() {
            const deletePostsContainer = document.getElementById('deletePostsContainer');
            deletePostsContainer.innerHTML = '';

            try {
                const postsQuerySnapshot = await db.collection('posts')
                    .where('assignedUser', '==', currentUsername)
                    .get();

                if (postsQuerySnapshot.empty) {
                    deletePostsContainer.innerHTML = '<p class="no-posts">沒有找到相關的留言。</p>';
                } else {
                    postsQuerySnapshot.forEach((doc) => {
                        const postData = doc.data();
                        const postElement = document.createElement('div');
                        postElement.className = 'post-card';
                        postElement.setAttribute('data-id', doc.id);
                        postElement.innerHTML = `
                            <div class="post-header">
                                <h3>匿名留言</h3>
                                <span class="post-status ${postData.published ? 'published' : ''}">
                                    ${postData.published ? '已發布' : '未發布'}
                                </span>
                            </div>
                            <div class="post-content">${postData.content}</div>
                            ${postData.mediaUrls ? postData.mediaUrls.map(url => {
                                if (url.type === 'image') {
                                    return `<img src="${url.url}" alt="留言圖片" class="post-media">`;
                                } else if (url.type === 'video') {
                                    return `<video controls class="post-media">
                                                <source src="${url.url}" type="video/mp4">
                                                您的瀏覽器不支持視頻標籤。
                                            </video>`;
                                } else if (url.type === 'gif') {
                                    return `<img src="${url.url}" alt="留言GIF" class="post-media">`;
                                }
                            }).join('') : ''}
                            <div class="post-actions">
                                <input type="checkbox" class="delete-checkbox"> 選擇刪除
                            </div>
                        `;
                        deletePostsContainer.appendChild(postElement);
                    });
                }
            } catch (error) {
                console.error("獲取留言時出錯：", error);
                showNotification("載入留言失敗，請稍後再試。");
            }
        }

        // 刪除選擇的留言
        async function deleteSelectedPosts() {
            const postsContainer = document.getElementById('postsContainer');
            const checkboxes = postsContainer.getElementsByClassName('delete-checkbox');
            const selectedPostCards = Array.from(checkboxes).filter(checkbox => checkbox.checked).map(checkbox => checkbox.closest('.post-card'));

            if (selectedPostCards.length > 0) {
                for (const postCard of selectedPostCards) {
                    const postId = postCard.getAttribute('data-id');
                    if (postId) {
                        try {
                            await db.collection('posts').doc(postId).delete();
                            postCard.style.display = 'none';
                        } catch (error) {
                            console.error("刪除留言時出錯：", error);
                            showNotification("刪除留言失敗，請稍後再試。");
                        }
                    } else {
                        console.error("無法刪除留言，因為 postId 為空");
                        showNotification("刪除留言失敗，請稍後再試。");
                    }
                }
                showNotification("選擇的留言已刪除！");
            } else {
                showNotification("沒有選擇要刪除的留言。");
            }
        }

        // 登出功能
        document.getElementById('logoutBtn').addEventListener('click', () => {
            auth.signOut().then(() => {
                showNotification("已成功登出！");
            }).catch((error) => {
                console.error("登出錯誤：", error);
                showNotification("登出失敗，請稍後再試。");
            }).finally(() => {
                window.location.href = 'index.html';
            });
        });

        // 側邊欄功能
        function openNav() {
            document.getElementById("mySidebar").style.right = "0";
            document.getElementById("main").style.marginRight = "250px";
            document.getElementById("openBtn").style.display = "none";
        }

        function closeNav() {
            document.getElementById("mySidebar").style.right = "-100%";
            document.getElementById("main").style.marginRight = "0";
            document.getElementById("openBtn").style.display = "block";
        }

        // 顯示提示框
        function showNotification(message) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.style.display = 'block';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }

        // 上傳頭像功能
        function uploadAvatar() {
            document.getElementById('avatarUpload').click();
        }

        document.getElementById('avatarUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const user = auth.currentUser;
                if (user) {
                    const storageRef = storage.ref(`avatars/${user.displayName}`);
                    try {
                        await storageRef.put(file);
                        const downloadURL = await storageRef.getDownloadURL();
                        await db.collection('users').doc(user.displayName).update({
                            avatarUrl: downloadURL
                        });
                        document.getElementById('userAvatar').innerHTML = `<img src="${downloadURL}" alt="用戶頭像">`;
                        showNotification("頭像上傳成功！");
                    } catch (error) {
                        console.error("頭像上傳錯誤：", error);
                        showNotification("頭像上傳失敗，請稍後再試。");
                    }
                }
            }
        });

        // 顯示全部貼文
        async function showAllPosts() {
            const postsContainer = document.getElementById('postsContainer');
            postsContainer.innerHTML = '';

            try {
                const postsQuerySnapshot = await db.collection('posts')
                    .orderBy('createdAt', 'desc')
                    .get();

                if (postsQuerySnapshot.empty) {
                    postsContainer.innerHTML = '<p class="no-posts">沒有找到相關的貼文。</p>';
                } else {
                    postsQuerySnapshot.forEach((doc) => {
                        const postData = doc.data();
                        const createdAt = postData.createdAt ? postData.createdAt.toDate().toLocaleString() : '未知時間';
                        const postElement = document.createElement('div');
                        postElement.className = 'post-card';
                        postElement.setAttribute('data-id', doc.id);
                        postElement.innerHTML = `
                            <div class="post-header">
                                <h3>匿名留言</h3>
                                <span class="post-status ${postData.published ? 'published' : ''}">
                                    ${postData.published ? '已發布' : '未發布'}
                                </span>
                            </div>
                            <div class="post-content">${postData.content}</div>
                            <div class="post-info">
                                <p><strong>時間:</strong> ${createdAt}</p>
                                <p><strong>負責人:</strong> ${postData.assignedUser || '未知'}</p>
                                <p><strong>IP 位置:</strong> ${postData.ipAddress || '未知'}</p>
                            </div>
                            ${postData.mediaUrls ? postData.mediaUrls.map(url => {
                                if (url.type === 'image') {
                                    return `<img src="${url.url}" alt="留言圖片" class="post-media">`;
                                } else if (url.type === 'video') {
                                    return `<video controls class="post-media">
                                                <source src="${url.url}" type="video/mp4">
                                                您的瀏覽器不支持視頻標籤。
                                            </video>`;
                                } else if (url.type === 'gif') {
                                    return `<img src="${url.url}" alt="留言GIF" class="post-media">`;
                                }
                            }).join('') : ''}
                            <div class="post-actions">
                                <input type="checkbox" class="delete-checkbox"> 選擇刪除
                                <button class="download-btn" onclick="downloadPostAsImage(this)">下載圖片</button>
                            </div>
                        `;
                        postsContainer.appendChild(postElement);
                    });
                }
            } catch (error) {
                console.error("獲取貼文時出錯：", error);
                showNotification("載入貼文失敗，請稍後再試。");
            }
        }

        // 下載留言為圖片功能
        async function downloadPostAsImage(button) {
            const postCard = button.closest('.post-card');
            const postId = postCard.getAttribute('data-id');
            
            try {
                // 更新資料庫中的發布狀態
                await db.collection('posts').doc(postId).update({
                    published: true,
                    publishedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // 更新UI顯示
                const statusSpan = postCard.querySelector('.post-status');
                if (statusSpan) {
                    statusSpan.textContent = '已發布';
                    statusSpan.classList.add('published');
                }
            } catch (error) {
                console.error("更新發布狀態時出錯：", error);
                showNotification("更新發布狀態失敗，但將繼續下載圖片。");
            }
            
            // 檢查是否有附加圖片或照片
            const mediaElements = postCard.querySelectorAll('img, video');
            if (mediaElements.length > 0) {
                // 如果有附加媒體，直接下載所有媒體
                mediaElements.forEach(async (mediaElement, index) => {
                    try {
                        const mediaUrl = mediaElement.src;
                        const response = await fetch(mediaUrl, {
                            mode: 'cors',
                            headers: {
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `附加媒體_${postId}_${index + 1}${getFileExtension(mediaUrl)}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    } catch (error) {
                        console.error("下載媒體文件時出錯：", error);
                        showNotification(`下載媒體文件失敗：${error.message}`);
                    }
                });
            }
            
            // 生成並下載模板圖片
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 800;
            canvas.height = 600;
            
            // 載入背景圖片
            const backgroundImage = new Image();
            backgroundImage.crossOrigin = "anonymous"; // 添加跨域支持
            backgroundImage.src = '乾淨天中.png';
            await new Promise((resolve) => {
                backgroundImage.onload = resolve;
            });
            ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
            
            // 設置文字樣式
            ctx.font = 'bold 28px Arial, "Noto Sans TC", sans-serif';
            ctx.fillStyle = '#605feb';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 獲取匿名內容
            const content = postCard.querySelector('.post-content').textContent;
            
            // 文字換行處理
            const maxWidth = 700;
            const lineHeight = 40;
            let x = canvas.width / 2;
            let y = canvas.height / 2 - 50;
            
            // 改進的文字換行處理
            let lines = [];
            let words = content.split('');
            let currentLine = '';
            
            // 根據字數動態調整字體大小
            let fontSize = 28;
            if (content.length < 20) {
                fontSize = 48;
            } else if (content.length < 50) {
                fontSize = 36;
            }
            ctx.font = `bold ${fontSize}px Arial, "Noto Sans TC", sans-serif`;
            
            // 逐字檢查並換行
            for (let i = 0; i < words.length; i++) {
                let testLine = currentLine + words[i];
                let metrics = ctx.measureText(testLine);
                let testWidth = metrics.width;
                
                if (testWidth > maxWidth && i > 0) {
                    lines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine);
            
            // 計算總高度並調整起始位置
            const totalHeight = lines.length * lineHeight;
            const topMargin = 100;
            const bottomMargin = 150;
            let startY = Math.max(topMargin, (canvas.height - totalHeight) / 2);
            
            // 確保文字不會超出底部
            if (startY + totalHeight > canvas.height - bottomMargin) {
                startY = canvas.height - bottomMargin - totalHeight;
            }
            
            // 繪製文字
            lines.forEach((line, index) => {
                const currentY = startY + index * lineHeight;
                ctx.fillText(line, x, currentY);
            });
            
            // 將 canvas 轉換為圖片並下載
            canvas.toBlob(async blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `匿名留言_${postId}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showNotification("圖片已下載，留言已標記為已發布！");
            }, 'image/png');
        }

        // 輔助函數：獲取文件擴展名
        function getFileExtension(url) {
            return url.split('.').pop().split(/\#|\?/)[0];
        }
