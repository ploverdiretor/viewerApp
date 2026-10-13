// ==========================================
// 【前半】変数定義・基本操作・各種イベント（内部メモリ連動版）
// ==========================================

// 対応する画像拡張子の定義
const ALLOWED_EXTENSIONS = ['webp', 'bmp', 'jpg', 'jpeg', 'png', 'avif'];

// フラットなファイルリストを階層的なツリー構造に変換するオブジェクト
let fileStructure = {};
// 現在選択されているフォルダーのオブジェクトデータを丸ごと保持する変数
let currentFolderData = null;
// 現在選択されているフォルダーの名前を保持する変数
let currentFolderName = "";
// 現在表示している開始位置のインデックス
let startIndex = 0;

// サイドバーの表示・非表示を切り替えるイベント
document.getElementById('toggle-btn').addEventListener('click', function() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
});

// 表示枚数が変更されたら、開始位置をリセットして再描画
document.getElementById('image-limit').addEventListener('change', function() {
  startIndex = 0;
  if (currentFolderData) displayImages(currentFolderData._files);
  this.blur();
});

// チェックボックスの変更イベントを監視してクラスを切り替える
document.getElementById('fit-checkbox').addEventListener('change', function() {
  const grid = document.getElementById('image-grid');
  if (this.checked) {
    grid.classList.remove('fill-mode');
  } else {
    grid.classList.add('fill-mode');
  }
  this.blur();
});

// メモパネルの表示／非表示トグルイベント
document.getElementById('memo-toggle-btn').addEventListener('click', function() {
  const memoPanel = document.getElementById('memo-panel');
  memoPanel.classList.toggle('visible');
  this.blur();
});

// 【修正】ダウンロードを実行すると同時に、アプリの内部メモリにもメモを即時記憶する
document.getElementById('memo-save-btn').addEventListener('click', function() {
  if (!currentFolderName || !currentFolderData) return;
  const text = document.getElementById('memo-textarea').value;
  
  // 1. 次回読み込みのためにファイルをダウンロード
  const blob = new Blob([text], { type: 'text/plain' });
  const anchor = document.createElement('a');
  anchor.download = `${currentFolderName}_memo.txt`;
  anchor.href = URL.createObjectURL(blob);
  anchor.click();
  URL.revokeObjectURL(anchor.href);

  // 2. 【最重要】現在のアプリ環境内でも即時復元できるよう、仮想ファイル（Blob）を内部データに直接上書き保存
  const virtualFile = new File([blob], `${currentFolderName}_memo.txt`, { type: "text/plain" });
  
  // 過去のメモファイルがあれば上書き、なければ新しく配列に追加
  const existingIdx = currentFolderData._txtFiles.findIndex(f => f.name.toLowerCase() === `${currentFolderName.toLowerCase()}_memo.txt`);
  if (existingIdx !== -1) {
    currentFolderData._txtFiles[existingIdx] = virtualFile;
  } else {
    currentFolderData._txtFiles.push(virtualFile);
  }
});

// 【共通関数】前の画像にずらす処理
function movePrev() {
  if (startIndex > 0) {
    startIndex--;
    if (currentFolderData) displayImages(currentFolderData._files);
  }
}

// 【共通関数】次の画像にずらす処理
function moveNext() {
  const limitValue = document.getElementById('image-limit').value;
  if (limitValue === 'all') return;

  const limit = parseInt(limitValue, 10);
  if (currentFolderData && startIndex + limit < currentFolderData._files.length) {
    startIndex++;
    displayImages(currentFolderData._files);
  }
}

// ボタンクリックイベントの登録
document.getElementById('prev-btn').addEventListener('click', movePrev);
document.getElementById('next-btn').addEventListener('click', moveNext);

// コントロールパネルの表示・非表示を切り替える関数
function toggleControlPanel() {
  const panel = document.getElementById('control-panel');
  panel.classList.toggle('panel-hidden');
}

// 全画面表示（フルスクリーン）を切り替える関数
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`フルスクリーンエラー: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

document.getElementById('hide-menu-btn').addEventListener('click', toggleControlPanel);
document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);

// キーボードの入力を監視するイベント
document.addEventListener('keydown', function(e) {
  if (document.activeElement === document.getElementById('memo-textarea')) {
    return;
  }
  if (e.key === 'h' || e.key === 'H') {
    toggleControlPanel();
  }
  if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }
  if (e.key === 'ArrowLeft') {
    movePrev();
  }
  if (e.key === 'ArrowRight') {
    moveNext();
  }
});

// マウスホイールの回転を監視するイベント
document.querySelector('.viewer').addEventListener('wheel', function(e) {
  if (e.target === document.getElementById('memo-textarea')) {
    return;
  }
  e.preventDefault();
  if (e.deltaY > 0) {
    moveNext();
  } else if (e.deltaY < 0) {
    movePrev();
  }
}, { passive: false });



//------------------------------------------------------------------------------------


// ==========================================
// 【後半】フォルダー処理・ツリー構築・画像表示
// ==========================================

// フォルダー選択時の処理
document.getElementById('folder-input').addEventListener('change', function(e) {
  const fileList = Array.from(e.target.files);
  if (fileList.length === 0) return;

  fileStructure = {};
  currentFolderData = null;
  currentFolderName = "";
  startIndex = 0;

  fileList.sort((a, b) => {
    const pathA = a.webkitRelativePath || a.name;
    const pathB = b.webkitRelativePath || b.name;
    return pathA.localeCompare(pathB, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const pathStr = file.webkitRelativePath || file.name;
    const pathParts = pathStr.split('/');
    
    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = ALLOWED_EXTENSIONS.includes(ext);
    const isTxt = (ext === 'txt');
    if (!isImage && !isTxt) continue;

    let current = fileStructure;
    for (let j = 0; j < pathParts.length - 1; j++) {
      const part = pathParts[j];
      if (!current[part]) {
        current[part] = { _files: [], _txtFiles: [], _subfolders: {} };
      }
      if (j === pathParts.length - 2) {
        if (isImage) current[part]._files.push(file);
        if (isTxt) current[part]._txtFiles.push(file);
      }
      current = current[part]._subfolders;
    }
  }

  const treeContainer = document.getElementById('tree-container');
  treeContainer.innerHTML = '';
  renderTree(fileStructure, treeContainer);
});

// フォルダーツリーをDOMとして再帰的に描画する関数
function renderTree(structure, parentElement) {
  const sortedFolderNames = Object.keys(structure).sort((a, b) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (const folderName of sortedFolderNames) {
    const node = document.createElement('div');
    node.className = 'tree-node';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.textContent = folderName;
    
    const folderData = structure[folderName];
    
    const hasSubfolders = Object.keys(folderData._subfolders).length > 0;
    if (hasSubfolders) {
      nameSpan.classList.add('has-sub');
    }

    const subContainer = document.createElement('div');
    subContainer.className = 'subfolders-container';
    
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      
      document.querySelectorAll('.folder-name').forEach(el => el.classList.remove('active'));
      nameSpan.classList.add('active');
      
      currentFolderData = folderData;
      currentFolderName = folderName;
      startIndex = 0;

      document.getElementById('memo-folder-title').textContent = `📁 ${folderName} のメモ`;
      document.getElementById('memo-textarea').value = "";

      const targetMemoFile = folderData._txtFiles.find(f => f.name.toLowerCase() === `${folderName.toLowerCase()}_memo.txt`);
      if (targetMemoFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
          document.getElementById('memo-textarea').value = event.target.result;
        };
        reader.readAsText(targetMemoFile);
      }

      updateLimitSelector(folderData._files.length);
      displayImages(folderData._files);

      if (hasSubfolders) {
        subContainer.classList.toggle('expanded');
        nameSpan.classList.toggle('is-expanded');
      }
    });

    node.appendChild(nameSpan);

    if (hasSubfolders) {
      renderTree(folderData._subfolders, subContainer);
      node.appendChild(subContainer);
    }

    parentElement.appendChild(node);
  }
}

// 画像枚数に応じてセレクトボックス（表示枚数）を動的に書き換える関数
function updateLimitSelector(totalFiles) {
  const selector = document.getElementById('image-limit');
  selector.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'すべて';
  selector.appendChild(allOption);

  for (let i = 1; i <= totalFiles; i++) {
    const option = document.createElement('option');
    option.value = i.toString();
    option.textContent = `${i}枚`;
    selector.appendChild(option);
  }

  selector.value = 'all';
}

// 右側の画面に選択したフォルダー内の画像を横並び表示する関数
function displayImages(files) {
  const grid = document.getElementById('image-grid');
  grid.innerHTML = '';

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const pageInfo = document.getElementById('page-info');

  if (!files || files.length === 0) {
    grid.innerHTML = '<p class="placeholder-text" style="position: absolute; top: 80px; left: 20px;">このフォルダーに対応画像はありません。</p>';
    pageInfo.textContent = '0 / 0';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const limitValue = document.getElementById('image-limit').value;
  let targetFiles = files;
  let totalFiles = files.length;
  let endIndex = totalFiles;

  if (limitValue !== 'all') {
    const limit = parseInt(limitValue, 10);
    
    endIndex = Math.min(startIndex + limit, totalFiles);
    targetFiles = files.slice(startIndex, endIndex);

    prevBtn.disabled = (startIndex === 0);
    nextBtn.disabled = (endIndex >= totalFiles);
    
    pageInfo.textContent = `${startIndex + 1} - ${endIndex} / ${totalFiles}`;
  } else {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    pageInfo.textContent = `1 - ${totalFiles} / ${totalFiles}`;
  }

  targetFiles.forEach(file => {
    const item = document.createElement('div');
    item.className = 'image-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const nameLabel = document.createElement('div');
    nameLabel.className = 'image-name';
    nameLabel.textContent = file.name;

    item.appendChild(img);
    item.appendChild(nameLabel);
    grid.appendChild(item);
  });
}
