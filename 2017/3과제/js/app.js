window.dd = console.log.bind(console)

// 프로토타입 함수 설정

EventTarget.prototype.toPromise = function (event = 'onsuccess') {
  return new Promise((resolve) => {
    this[event] = (e) => resolve(e.target.result)
  })
}

// indexedDB 에 관한 객체
const IDB = {
  db: null,
  datas: {},

  async open(dbname, stores) {
    const db = indexedDB.open(dbname, 5)

    db.onupgradeneeded = (e) => {
      const options = { keyPath: 'idx', autoIncrement: true }

      for (let store of stores)
        e.target.result.createObjectStore(store, options)
    }

    IDB.db = await db.toPromise()

    await this.refresh()
  },

  async dispatch(name, method, arg) {
    return this.db
      .transaction(name, 'readwrite')
      .objectStore(name)
      [method](arg)
      .toPromise()
  },

  async action(...args) {
    const result = await this.dispatch(...args)
    await this.refresh()

    return result
  },

  async refresh() {
    for (let name of IDB.db.objectStoreNames)
      this.datas[name] = await this.dispatch(name, 'getAll')
  },
}

// Uplaod 에 관한 객체
const Upload = {
  fileList: [],
  pendings: [],
  fileNames: {},

  addFile(files) {
    if (files.length === 0) {
      this.fileList = []
      this.fileNames = {}
    }

    for (const file of files) {
      if (file.type.split('/')[0] !== 'image') {
        alert('이미지 파일만 업로드 가능합니다.')
        $('.image-btns > button').attr({ disabled: false })
        return
      }
    }

    let boxHTML = ''

    if (
      files.length > 9 ||
      (this.fileList.length && this.fileList.length + files.length > 9)
    ) {
      $('#popup-image .form-image').after(
        `<div class="toast-warning"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 5.177l8.631 15.823h-17.262l8.631-15.823zm0-4.177l-12 22h24l-12-22zm-1 9h2v6h-2v-6zm1 9.75c-.689 0-1.25-.56-1.25-1.25s.561-1.25 1.25-1.25 1.25.56 1.25 1.25-.561 1.25-1.25 1.25z"/></svg>
        <p>이미지는 최대 10개 업로드 가능합니다.</p>
        <svg class="cancel" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>
        </div>`
      )

      setTimeout(() => {
        $('.toast-warning').remove()
      }, 4000)
    }

    Array.from(files).forEach((file) => {
      if (!this.fileNames[file.name] && this.fileList.length <= 9) {
        this.fileList.push(file)
        this.fileNames[file.name] = file.name
      }
    })

    this.fileList.forEach((file) => {
      boxHTML += `
      <span>
        <img src="${URL.createObjectURL(file)}"/>
        <span class="image-name">${file.name}</span>
      </span>
    `
    })

    $('#imageBox').html(boxHTML)

    $('.image-btns > button').attr({ disabled: false })
  },
}

// Editor에 관한 객체
const Editor = {
  init() {
    this.hook()
    this.tabRefresh()
    this.tabActive()
  },

  hook() {
    $(document)
      .on('keydown', (e) => {
        if (Folder.folder.nowTab && (e.metaKey || e.ctrlKey)) {
          if (e.key === 'w' || e.key === 'ㅈ') {
            e.preventDefault()
            const { route, name } = Folder.folder.nowTab
            const file = Folder.getChildren([
              '/',
              ...route.split('/').filter((r) => r),
            ])[name]

            if (file.content !== file.tmpContent) {
              const check = confirm(
                '저장하시지 않으시면 파일이 손상될 수 있습니다!!'
              )
              if (check) this.tabClose(Folder.folder.nowTab.idx)
              else Editor.tabSave()
            } else {
              this.tabClose(Folder.folder.nowTab.idx)
            }
          }

          if (e.key === 's' || e.key === 'ㄴ') {
            e.preventDefault()
            this.tabSave()
          }
        }
      })
      .on('click', '.file-list .append-li', this.tabAppend)
      .on('click', '.editor-tab > div', function () {
        Editor.tabSave()
        Editor.tabOpen($(this).data('idx'))
      })
      .on('mouseenter', '.editor-nosave', function () {
        $(this).hide()
        $(this).parent('div').find('.editor-close').show()

        $(document).on(
          'mouseleave',
          '.editor-tab .this .editor-close',
          function () {
            $(this).hide()
            $(this).parent('div').find('.editor-nosave').show()
          }
        )
      })

      .on('keydown input', '.editor-textarea', function (e) {
        switch (e.type) {
          case 'keydown': {
            if (e.keyCode === 9) {
              const value = $(this).val()

              let start = this.selectionStart
              let end = this.selectionEnd

              if (start !== end) {
                let tabCnt = 0
                let line = this.value.slice(start, end).split('\n')

                line.forEach((v, ix) => {
                  line[ix] = '\t' + v
                  tabCnt += 1
                })

                this.value =
                  this.value.slice(0, start) +
                  line.join('\n') +
                  this.value.slice(end)

                this.selectionStart = this.selectionEnd = end + tabCnt
              } else {
                $(this).val(
                  value.substring(0, start) + '\t' + value.substring(end)
                )

                this.selectionStart = this.selectionEnd = start + 1
              }

              e.preventDefault()
            }
          }
          case 'input': {
            if ($(this).attr('readonly')) return null
            const $nowTab = $(
              `.editor-tab > div[data-idx="${Folder.folder.nowTab.idx}"] `
            )

            const { route, name } = Folder.folder.nowTab

            const file = Folder.getChildren([
              '/',
              ...route.split('/').filter((r) => r),
            ])[name]

            file.tmpContent = $(this).val()
            Folder.update()

            if (file.content !== file.tmpContent) {
              $nowTab.find('.editor-close').hide()
              $nowTab.find('.editor-nosave').show()
            } else {
              $nowTab.find('.editor-close').show()
              $nowTab.find('.editor-nosave').hide()
            }
          }
        }
      })
      .on('click', '.save', this.tabSave)
      .on('click', '.editor-close', (e) => {
        e.stopPropagation()
        this.tabClose($(e.target).parent('div').data('idx'))
      })
      .on('click', '.preview', function () {
        if (!Folder.folder.nowTab) return alert('HTML파일을 열어주세요!!')
        const sp = Folder.folder.nowTab.name.split('.')

        if (sp[sp.length - 1] === 'html') {
          const wPopup = window.open()
          wPopup.document.write($('.editor textarea').val())
        } else return alert('html 확장자만 미리보기 가능합니다.')
      })
  },

  async tabAppend() {
    const name = $(this).data('name').replaceAll('<', '&lt;')
    const route = $(this).data('route').replaceAll('<', '&lt;')
    const type = $(this).hasClass('image-li') ? 'image' : 'file'
    const exist_tab = IDB.datas.tab.find(
      (tab) => tab.name === name && tab.route === route
    )
    const idx = exist_tab
      ? exist_tab.idx
      : await IDB.action('tab', 'add', {
          name,
          type,
          route,
          path: Folder.route,
          ...($(this).hasClass('image-li') && {
            file: Folder.nowChildren[name].file,
          }),
        })

    Folder.folder.nowTab = {
      idx,
      name,
      type,
      route,
      content: '',
      tmpContent: '',
    }

    Folder.update()
    Editor.tabRefresh()
    Editor.tabActive()
  },

  tabActive() {
    const { nowTab } = Folder.folder

    if (!IDB.datas.tab.length || !nowTab) {
      $('.image').html('')
      $('.editor-textarea').attr('readonly', true).val('')
      return
    }

    // 에디터 탭 활성화 시키기
    $(`.editor-tab > div[data-idx="${nowTab.idx}"]`)
      .addClass('this')
      .siblings()
      .removeClass('this')

    if (nowTab.type === 'image') this.imageRender()
    else if (nowTab.type === 'file') this.fileRender()
  },

  async tabOpen(idx) {
    const tab = await IDB.action('tab', 'get', idx)

    Folder.folder.nowTab = {
      idx,
      ...Folder.getChildren(tab.path)[tab.name],
    }
    Folder.update()

    Editor.tabActive()
  },

  tabRefresh() {
    let menuHTML = ''

    for (let { idx, type, name, route } of IDB.datas.tab) {
      const ext_arr = name.split('.')
      const ext = ext_arr[ext_arr.length - 1]
      menuHTML += `
      <div data-type="${type}" data-idx="${idx}" data-name="${name}" data-route="${route}">
        <span class="ico">
        ${
          type === 'folder'
            ? `
            <svg>
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path>
            </svg>
          `
            : ''
        }
        ${
          type === 'file'
            ? 'js' === ext
              ? `
              <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 630 630">
              <g id="logo">
              <rect id="background" x="0" y="0" width="630" height="630" fill="#f7df1e" />
              <path id="j" d="m 165.65,526.47375 48.2125,-29.1775 C 223.16375,513.7875 231.625,527.74 251.92,527.74 c 19.45375,0 31.71875,-7.60975 31.71875,-37.21 l 0,-201.3 59.20375,0 0,202.1375 c 0,61.32 -35.94375,89.23125 -88.385,89.23125 -47.36125,0 -74.8525,-24.52875 -88.8075,-54.13" />
              <path id="s" d="m 375,520.13 48.20625,-27.91125 c 12.69,20.72375 29.1825,35.9475 58.36125,35.9475 24.53125,0 40.17375,-12.26475 40.17375,-29.18125 0,-20.29875 -16.06875,-27.48875 -43.135,-39.32625 l -14.7975,-6.3475 c -42.715,-18.18125 -71.05,-41.0175 -71.05,-89.2275 0,-44.40375 33.83125,-78.2375 86.695,-78.2375 37.6375,0 64.7025,13.11125 84.15375,47.36625 l -46.09625,29.60125 c -10.15,-18.1825 -21.1425,-25.37125 -38.0575,-25.37125 -17.33875,0 -28.335,10.995 -28.335,25.37125 0,17.7625 10.99625,24.9525 36.3675,35.94875 l 14.8,6.3425 c 50.325,21.56875 78.66,43.5575 78.66,93.03375 0,53.2875 -41.86625,82.465 -98.11,82.465 -54.97625,0 -90.5,-26.2175 -107.83625,-60.47375" />
            </g>
            </svg>
            `
              : 'css' === ext
              ? `
              <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                <path
                  fill="rgb(100, 150, 255)"
                  d="M5,3L4.35,6.34H17.94L17.5,8.5H3.92L3.26,11.83H16.85L16.09,15.64L10.61,17.45L5.86,15.64L6.19,14H2.85L2.06,18L9.91,21L18.96,18L20.16,11.97L20.4,10.76L21.94,3H5Z"
                />
              </svg>
            `
              : 'html' === ext
              ? `
              <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                <path
                  fill="rgb(255, 50, 0)"
                  d="M12,17.56L16.07,16.43L16.62,10.33H9.38L9.2,8.3H16.8L17,6.31H7L7.56,12.32H14.45L14.22,14.9L12,15.5L9.78,14.9L9.64,13.24H7.64L7.93,16.43L12,17.56M4.07,3H19.93L18.5,19.2L12,21L5.5,19.2L4.07,3Z"
                />
              </svg>
            `
              : `
              <svg>
                <path d="M12,0H4C2.896,0,2.01,0.896,2.01,2L2,18c0,1.104,0.886,2,1.99,2H16c1.104,0,2-0.896,2-2V6L12,0z M11,4H11  z M11,7V1.5L16.5,7H11z"></path>
              </svg>
            `
            : ''
        }
      ${
        type === 'image'
          ? `<svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="rgb(0, 255, 255)" d="M5 8.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5c0 .829-.672 1.5-1.5 1.5s-1.5-.671-1.5-1.5zm9 .5l-2.519 4-2.481-1.96-4 5.96h14l-5-8zm8-4v14h-20v-14h20zm2-2h-24v18h24v-18z"/></svg>`
          : ''
      }
      </span>
        <span class="editor-text">${name}</span>
        <span class="editor-close">&times;</span>
        <span class="editor-nosave"></span>
      </div>
      `
    }

    $('.editor-tab').html(menuHTML)
  },

  tabSave() {
    const { nowTab } = Folder.folder

    const file = Folder.getChildren([
      '/',
      ...nowTab.route.split('/').filter((r) => r),
    ])[nowTab.name]

    file.content = file.tmpContent

    Folder.update()

    const $tab = $(`.editor-tab > div[data-idx="${nowTab.idx}"]`)

    $tab.find('.editor-close').show()
    $tab.find('.editor-nosave').hide()
  },

  async tabClose(tabIdx) {
    await IDB.action('tab', 'delete', tabIdx)

    const {
      tab: { length },
    } = IDB.datas

    Editor.tabRefresh()

    if (Folder.folder.nowTab.idx === tabIdx && length)
      Editor.tabOpen(
        $('.editor-tab > div')
          .eq(length - 1)
          .data('idx')
      )
    else if (!length) {
      delete Folder.folder.nowTab
      Folder.update()
      Editor.tabActive()
      $('.append-li').removeClass('this')
    }
  },

  async fileRender() {
    const { route, name } = Folder.folder.nowTab
    const data = ['/', ...route.split('/')].filter((r) => r)

    const file = Folder.getChildren(data)[name]

    $('.editor-textarea').attr('readonly', false).val(file.content)
    $('.image-box').html('')
  },

  async imageRender() {
    const { file } = await IDB.action('tab', 'get', Folder.folder.nowTab.idx)

    const imageHTML = `
      <div class="image">
        <img src="${URL.createObjectURL(file)}"/>
      </div>
    '`

    $('.editor-textarea').attr('readonly', true).val('')
    $('.editor .image-box').html(imageHTML)
  },
}

// Folder 에 관한 객체
const Folder = {
  state: {
    contextMenuInfo: {},
  },
  // 초기 작업
  init() {
    this.moveFolder(['/'])
    this.hook()
  },

  // 이벤트를 처리하는 코드 hook
  hook() {
    $(document)
      .on('submit', '.folderForm, .fileForm', (e) => {
        e.preventDefault()

        const type =
          e.currentTarget.className === 'folderForm' ? 'folder' : 'file'
        const nameVal = $(`#${type}Name`).val().replaceAll('<', '&lt;')
        const name =
          type === 'folder' ? nameVal : nameVal + '.' + $('#fileExt').val()

        if (this.overlapChk(this.nowChildren, name))
          return alert(
            `${type === 'folder' ? '폴더' : '파일'} 이름이 중복되었습니다.`
          )

        this.nowChildren[name] = {
          name,
          type,
          route: Folder.getRoute(),
          path: this.route,
          content: '',
          tmpContent: '',
          children: {},
        }

        Popup.onHidePopup(`#popup-${type}`)

        this.update()
        this.viewFolder()
      })
      .on('contextmenu', '.append-li', function (e) {
        e.preventDefault()

        const name = $(this).data('name').replaceAll('<', '&lt;')
        const route = $(this).data('route')

        $('.context_menu').css({ left: e.pageX, top: e.pageY }).fadeIn()

        Folder.state.contextMenuInfo = {
          name,
          route,
        }
      })
      .on('mouseenter mouseleave', '.context_menu > div', function (e) {
        if (e.type === 'mouseenter') $(this).addClass('active')
        else if (e.type === 'mouseleave') $(this).removeClass('active')
      })
      .on('click', '.context_menu .rename-item', (e) => {
        $('.popup-background').fadeIn()
        $('#popup-rename').fadeIn()
        $('.context_menu').hide()

        $('#rename').val(this.state.contextMenuInfo.name)

        $('#rename').select()
      })
      .on('submit', '.renameForm', async (e) => {
        e.preventDefault()

        const {
          contextMenuInfo: { name: beforeName, route },
        } = Folder.state
        const afterName = $('#rename').val()

        Folder.nowChildren[afterName] = {
          ...Folder.nowChildren[beforeName],
          name: afterName,
        }

        delete Folder.nowChildren[beforeName]
        Folder.update()
        Folder.viewFolder()

        const putTab = IDB.datas.tab.find(
          (el) => el.name === beforeName && el.route === route
        )

        if (putTab) {
          putTab.name = afterName

          const idx = await IDB.action('tab', 'put', putTab)

          Folder.folder.nowTab = await IDB.action('tab', 'get', idx)

          Editor.tabRefresh()
        }

        Popup.onHidePopup('#popup-rename')
      })
      .on('click', '.context_menu .remove-item', (e) => {
        const { name, route } = Folder.state.contextMenuInfo

        const contextTab = IDB.datas.tab.find(
          (tab) => tab.name === name && tab.route === route
        )

        delete Folder.nowChildren[name]
        contextTab && Editor.tabClose(contextTab.idx)

        Folder.update()
        Folder.viewFolder()

        $('.context_menu').hide()
      })

      .on('mousedown', function (e) {
        if (
          !$(e.target).hasClass('context_menu') &&
          !$(e.target).parents('.context_menu').length
        ) {
          $('.context_menu').hide()
        }
      })
      .on(
        'dragstart drop dragover dragleave dragend',
        '.append-li',
        async function (e) {
          switch (e.type) {
            case 'dragstart':
              $(this).addClass('draging')
              e.originalEvent.dataTransfer.setData('text', $(this).data('name'))
              e.originalEvent.dataTransfer.setData(
                'route',
                $(this).data('route')
              )
              break

            case 'drop':
              const name = e.originalEvent.dataTransfer.getData('text')
              const route = e.originalEvent.dataTransfer.getData('route')

              $(this).removeClass('dragovered')

              if (!$(this).parent('.folder-list').length)
                return alert('폴더에 드롭해주세요!!')

              Folder.overlapChk(Folder.nowChildren[$(this).data('name')], name)

              const putTab = IDB.datas.tab.find(
                (tab) => tab.name === name && tab.route === route
              )

              await IDB.action('tab', 'put', {
                ...putTab,
                path: [...Folder.route, $(this).data('name')],
                route: Folder.getRoute() + '/' + $(this).data('name'),
              })

              $(`.append-li[data-name="${name}"`).remove()

              Folder.nowChildren[name].route =
                Folder.getRoute() + '/' + $(this).data('name')

              Folder.nowChildren[$(this).data('name')].children[name] =
                Folder.nowChildren[name]

              delete Folder.nowChildren[name]

              Folder.update()

              e.preventDefault()
              break
            case 'dragover':
              $(this).addClass('dragovered')

              e.preventDefault()
              break
            case 'dragleave':
              $(this).removeClass('dragovered')
              break
            case 'dragend':
              $(this).removeClass('draging')
              break
          }
        }
      )
      .on('drop dragover dragleave', '#imageBox, .drop-box', function (e) {
        switch (e.type) {
          case 'dragover':
            e.preventDefault()

            if ($('.drop-box')[0].style.visibility !== 'visible')
              $('.drop-box').css({ visibility: 'visible', opacity: 1 })

            break
          case 'dragleave':
            if (
              e.target.id !== 'imageBox' &&
              $('.drop-box')[0].style.visibility !== 'hidden'
            )
              $('.drop-box').css({ visibility: 'hidden', opacity: 0 })
            break
          case 'drop':
            e.preventDefault()

            $('.drop-box').css({ visibility: 'hidden', opacity: 0 })
            Upload.addFile(e.originalEvent.dataTransfer.files)
            break
        }
      })
      .on('change', '#imageName', function () {
        $('.image-btns > button').attr({ disabled: true })

        Upload.addFile(this.files)
      })
      .on('click', '.image-uploadBtn', function () {
        if (!Upload.fileList.length) return alert('이미지를 업로드해 주세요.')

        Upload.fileList.forEach((file) => {
          const { name } = file

          if (Folder.overlapChk(name))
            return alert('파일이름이 중복되었습니다.')

          Folder.nowChildren[name] = {
            name,
            type: 'image',
            route: Folder.getRoute(),
            file,
          }
        })

        Upload.fileList = []
        Upload.fileNames = {}
        $('#imageBox').html('')

        Folder.update()
        Folder.viewFolder()
        Popup.onHidePopup('#popup-image')
      })
      .on('click', '.folder-list .append-li', function () {
        Folder.route.push($(this).data('name'))

        Folder.moveFolder(Folder.route)
      })
      .on('click', '.logo > a', () => {
        this.moveFolder(['/'])
      })
      .on('click', '.path > div.prev', (e) => {
        const route = this.route.slice(
          0,
          this.route.findIndex((r) => r === e.currentTarget.textContent) + 1
        )
        this.moveFolder(route)
      })
      .on('click', '.parent-list', function () {
        Folder.route.pop()

        Folder.moveFolder(Folder.route)
      })
  },

  // 폴더 이동
  moveFolder(route) {
    this.route = route

    this.changeDirPath()
    this.viewFolder()
  },

  // 경로 변경
  changeDirPath() {
    let html = ''

    $('.path').remove()

    this.route.forEach((route, idx) => {
      html += `
      <div class="path">
        <div class="text prev">${route.replaceAll('<', '&lt;')}</div>
        ${
          idx !== this.route.length - 1
            ? `
            <div class="right-btn">
              <svg>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path>
              </svg>
            </div>
          `
            : ''
        }
      </div>
    `
    })

    $('.dirPath').html(html)
  },

  // 폴더에 있는 파읾목록 보기
  viewFolder() {
    const children = this.getChildren(this.route)

    if (this.route.length === 1) $('.parent-list').hide()
    else $('.parent-list').show()

    $('.append-li').remove()

    for (let [key, { route }] of Object.entries(children)) {
      const { type } = children[key]

      const $list = type === 'folder' ? $('.folder-list') : $('.file-list')

      const extPiece = key.split('.')
      const ext = extPiece[extPiece.length - 1]

      $list.append(`
        <li class="append-li ${
          type === 'image' ? 'image-li' : ''
        }" data-name="${key}" data-route="${route}" draggable="true">
          <span>
            ${
              type === 'folder'
                ? `
                <svg>
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path>
                </svg>
              `
                : ''
            }
            ${
              type === 'file'
                ? 'js' === ext
                  ? `
                  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 630 630">
                  <g id="logo">
                  <rect id="background" x="0" y="0" width="630" height="630" fill="#f7df1e" />
                  <path id="j" d="m 165.65,526.47375 48.2125,-29.1775 C 223.16375,513.7875 231.625,527.74 251.92,527.74 c 19.45375,0 31.71875,-7.60975 31.71875,-37.21 l 0,-201.3 59.20375,0 0,202.1375 c 0,61.32 -35.94375,89.23125 -88.385,89.23125 -47.36125,0 -74.8525,-24.52875 -88.8075,-54.13" />
                  <path id="s" d="m 375,520.13 48.20625,-27.91125 c 12.69,20.72375 29.1825,35.9475 58.36125,35.9475 24.53125,0 40.17375,-12.26475 40.17375,-29.18125 0,-20.29875 -16.06875,-27.48875 -43.135,-39.32625 l -14.7975,-6.3475 c -42.715,-18.18125 -71.05,-41.0175 -71.05,-89.2275 0,-44.40375 33.83125,-78.2375 86.695,-78.2375 37.6375,0 64.7025,13.11125 84.15375,47.36625 l -46.09625,29.60125 c -10.15,-18.1825 -21.1425,-25.37125 -38.0575,-25.37125 -17.33875,0 -28.335,10.995 -28.335,25.37125 0,17.7625 10.99625,24.9525 36.3675,35.94875 l 14.8,6.3425 c 50.325,21.56875 78.66,43.5575 78.66,93.03375 0,53.2875 -41.86625,82.465 -98.11,82.465 -54.97625,0 -90.5,-26.2175 -107.83625,-60.47375" />
                </g>
                </svg>
                `
                  : 'css' === ext
                  ? `
                  <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                    <path
                      fill="rgb(100, 150, 255)"
                      d="M5,3L4.35,6.34H17.94L17.5,8.5H3.92L3.26,11.83H16.85L16.09,15.64L10.61,17.45L5.86,15.64L6.19,14H2.85L2.06,18L9.91,21L18.96,18L20.16,11.97L20.4,10.76L21.94,3H5Z"
                    />
                  </svg>
                `
                  : 'html' === ext
                  ? `
                  <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                    <path
                      fill="rgb(255, 50, 0)"
                      d="M12,17.56L16.07,16.43L16.62,10.33H9.38L9.2,8.3H16.8L17,6.31H7L7.56,12.32H14.45L14.22,14.9L12,15.5L9.78,14.9L9.64,13.24H7.64L7.93,16.43L12,17.56M4.07,3H19.93L18.5,19.2L12,21L5.5,19.2L4.07,3Z"
                    />
                  </svg>
                `
                  : `
                  <svg>
                    <path d="M12,0H4C2.896,0,2.01,0.896,2.01,2L2,18c0,1.104,0.886,2,1.99,2H16c1.104,0,2-0.896,2-2V6L12,0z M11,4H11  z M11,7V1.5L16.5,7H11z"></path>
                  </svg>
                `
                : ''
            }
          ${
            type === 'image'
              ? `<svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="rgb(0, 255, 255)" d="M5 8.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5c0 .829-.672 1.5-1.5 1.5s-1.5-.671-1.5-1.5zm9 .5l-2.519 4-2.481-1.96-4 5.96h14l-5-8zm8-4v14h-20v-14h20zm2-2h-24v18h24v-18z"/></svg>`
              : ''
          }
          </span>
          <a href="#">${key}</a>
        </li>
      `)
    }

    this.nowChildren = children
  },

  async update() {
    await IDB.action('folder', 'put', this.folder)
  },

  nameChk(name, type) {
    const text = type === 'folder' ? '폴더' : '파일'

    if (!name || !name.trim()) {
      alert(`${text} 이름을 입력해주세요`)
      return false
    }
    if (name.trim().charAt(0) === '.') {
      alert(`${text} 이름은 .문자로 시작할 수 없습니다`)
      return false
    }

    return true
  },

  overlapChk(children, name) {
    return children[name]
  },

  getRoute() {
    const name = []

    for (let [idx, route] of Object.entries(this.route)) {
      if (parseInt(idx) === 0) continue

      name.push(route)
    }

    return '/' + name.join('/')
  },

  getChildren(routes) {
    let children = this.folder

    for (let route of routes)
      children = children[route.replaceAll('<', '&lt;')].children

    return children
  },
}

const Popup = {
  init() {
    this.hook()
  },

  hook() {
    $(document)
      .on('click', '.popup-btn', (e) => {
        const id = $(e.currentTarget).data('popup')

        this.onShowPopup(id)

        if (id === '#popup-folder') {
          $('#folderName').val('무제 폴더')
          $('#folderName').select()
        }
        if (id === '#popup-file') $('#fileName').val('')
      })
      .on('click', '.popup-close', (e) => {
        const id = '#' + $(e.target).parents('.popup').attr('id')

        this.onHidePopup(id)
      })
  },

  onShowPopup(id) {
    $('.popup-background').fadeIn()

    $(id).find('.path-input').val(Folder.getRoute())
    $(id).fadeIn()
  },

  onHidePopup(id) {
    $('.popup-background').fadeOut()
    $(id).fadeOut()
  },
}

IDB.open('Editor', ['folder', 'tab']).then(async () => {
  if (!IDB.datas.folder.length) {
    const rootFolder = {
      '/': {
        name: '/',
        type: 'folder',
        children: {},
      },
    }

    await IDB.action('folder', 'add', rootFolder)
  }

  Folder.folder = IDB.datas.folder[0]

  Folder.init()
  Editor.init()
  Popup.init()
})
