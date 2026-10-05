// 対応する画像拡張子の定義
const ALLOWED_EXTENSIONS = ['webp', 'bmp', 'jpg', 'jpeg', 'png', 'avif'];

// フラットなファイルリストを階層的なツリー構造に変換するオブジェクト
let fileStructure = {};
// 現在選択されているフォルダーの画像リストを保持する変数
let currentFolderFiles = [];
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
  displayImages(currentFolderFiles);
  
  // 【新設】選択後にフォーカスを強制解除し、キーボード・ホイール操作の邪魔をしないようにする
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
  // チェックボックスも同様にフォーカスを解除
  this.blur();
});

// 【共通関数】前の画像にずらす処理
function movePrev() {
  if (startIndex > 0) {
    startIndex--;
    displayImages(currentFolderFiles);
  }
}

// 【共通関数】次の画像にずらす処理
function moveNext() {
  const limitValue = document.getElementById('image-limit').value;
  if (limitValue === 'all') return;

  const limit = parseInt(limitValue, 10);
  if (startIndex + limit < currentFolderFiles.length) {
    startIndex++;
    displayImages(currentFolderFiles);
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

// ボタンクリックイベントの登録
document.getElementById('hide-menu-btn').addEventListener('click', toggleControlPanel);
document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);

// キーボードの入力を監視するイベント
document.addEventListener('keydown', function(e) {
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
  e.preventDefault();

  if (e.deltaY > 0) {
    moveNext();
  } else if (e.deltaY < 0) {
    movePrev();
  }
}, { passive: false });

// フォルダー選択時の処理
document.getElementById('folder-input').addEventListener('change', function(e) {
  const fileList = Array.from(e.target.files);
  if (fileList.length === 0) return;

  fileStructure = {};
  currentFolderFiles = [];
  startIndex = 0;

  // 読み込んだファイルをパス（名前）の昇順で並び替える
  fileList.sort((a, b) => {
    const pathA = a.webkitRelativePath || a.name;
    const pathB = b.webkitRelativePath || b.name;
    return pathA.localeCompare(pathB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // 選択されたファイルをスキャンして仮想フォルダーツリーを構築
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const pathStr = file.webkitRelativePath || file.name;
    const pathParts = pathStr.split('/');
    
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

    let current = fileStructure;
    for (let j = 0; j < pathParts.length - 1; j++) {
      const part = pathParts[j];
      if (!current[part]) {
        current[part] = { _files: [], _subfolders: {} };
      }
      if (j === pathParts.length - 2) {
        current[part]._files.push(file);
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
      
      currentFolderFiles = folderData._files;
      startIndex = 0;

      // 選択されたフォルダーの画像枚数に合わせてセレクターを更新
      updateLimitSelector(currentFolderFiles.length);
      displayImages(currentFolderFiles);

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
