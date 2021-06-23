window.dd = console.log.bind('console')

/* 상수들 선언 */
const TS = 'transaction'
const CI = 'classification'
const LS = localStorage
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/* 배열 칼럼 */
Array.prototype.col = function (col) {
  return this.map((x) => x[col])
}

/* 영수증 정보 가져오기s */
function getInfo(datas) {
  let data = $.extend(
    {
      idx: datas.idx,
      fileName: datas.fileName,
      fileSize: datas.fileSize,
    },
    datas.content
  )

  data.week = WEEK[new Date(...data[TS].date.split('.')).getDay()]
  data.viewDate = data[TS].date + `(${data.week})` + data[TS].time
  data.viewPrice = data[TS].amount.toLocaleString()

  if (data.card.information === 'MASTER') {
    data.listClass = data.cardClass = 'fab fa-cc-mastercard'
    data.cardLabel = '마스터카드'
  } else {
    data.listClass = data.cardClass = 'fab fa-cc-visa'
    data.cardLabel = '비자카드'
  }

  if (data[TS][CI] === 'Payment') {
    data.payType = '결제'
    data.paySymbol = '-'
    data.payClass = 'has-text-danger'
  } else {
    data.payType = '취소'
    data.paySymbol = '+'
    data.payClass = 'has-text-link'
    data.listClass = 'fas fa-undo'
  }

  data.payPlace = data[TS].type === 'Offline' ? '오프라인' : '온라인'

  return data
}

/* 검색목록 가져오기 */
function getSearch(item) {
  return {
    viewDate: item.viewDate,
    name: item.more.name,
    cardLabel: item.cardLabel,
    viewPrice: item.viewPrice,
    payType: item.payType,
    payPlace: item.payPlace,
    cardNum: item.card.number,
    cardApp: item.card.approval,
    address: item.more.address,
    phone: item.more.call,
  }
}

/* 하이라이트 처리 */
function highright(data, keyword) {
  // 정규식에서 기호는 기능 부여가되있는데 esacpe 시켜서 일반 문자 검색하기
  const regex = new RegExp(/[\!\@\#\$\%\^\&\*\(\)\_\:\.]/, 'g')
  let result = {}

  searchKeyword = keyword.replace(regex, '\\$&')

  $.each(data, (key, val) => {
    result[key] = val.replace(
      new RegExp(searchKeyword, 'g'),
      `<mark style="background: #00d1b2; color: #fff">${keyword}</mark>`
    )
  })

  return result
}

/* 로컬 데이터 관리 */
const Local = {
  get get() {
    return JSON.parse(LS.getItem('Receipt'))
  },
  set(data) {
    LS.setItem('Receipt', JSON.stringify(data))
  },
  def() {
    if (!LS.getItem('Receipt')) {
      Local.set({
        idx: 0,
        list: [],
      })
    }
  },
}

/* 영수증 관련 기능들 */
const Receipt = {
  focused: [],
  timer: null,
  active: false,
  detail: false,
  keyWord: '',

  init() {
    this.handle()
    this.refresh()
  },

  handle() {
    $(document)
      /* 영수증 리스트 클릭&포커스 이벤트 */
      .on('click mouseup mousedown mouseleave', '.data-item', function (e) {
        switch (e.type) {
          case 'mousedown':
            $(this).addClass('loading')
            Receipt.timer = setTimeout(() => {
              $(this).removeClass('loading').toggleClass('is-focused')
            }, 2000)

            break
          case 'mouseup':
          case 'mouseleave':
            clearTimeout(Receipt.timer)
            setTimeout(() => {
              $(this).removeClass('loading')
            }, 10)
            break
          case 'click':
            if ($(this).hasClass('loading')) {
              Receipt.activeChange($(this).data('idx'))
            }
            break
        }
      })
      .on('click', '.detail-content > h1:first-child > a', function () {
        Receipt.detail = !Receipt.detail
        Receipt.viewDetail()
      })
      // 영수증의 내보내기 버튼 클릭시
      .on('click', '.detail .field > p:first-child', () => {
        Popup.exportFile(Receipt.activeItem)
      })
      // 영수증의 삭제버튼 클릭시
      .on('click', '.detail .field > p:last-child', () => {
        const local = Local.get

        local.list = local.list.filter(
          (el) => el.idx !== Receipt.activeItem.idx
        )
        Local.set(local)

        Receipt.refresh()
      })

      /* 검색 클릭 및 엔터 */
      .on('click', '.search-button', function () {
        Receipt.search()
      })
      .on('keydown', '.input', function (e) {
        if (e.key === 'Enter') Receipt.search()
      })
  },

  refresh() {
    let { list } = Local.get
    let prevDate = ''

    $('.panel').html('')

    list = list
      .map(getInfo)
      .sort((a, b) => {
        if (a.transaction.date > b.transaction.date) return -1
        if (a.transaction.date === b.transaction.date) return 0
        if (a.transaction.date < b.transaction.date) return 1
      })
      .filter((obj) => {
        let matching = true

        if (this.keyWord !== '') {
          matching = false
          const search = getSearch(obj)

          $.each(search, (key, val) => {
            if (val.includes(this.keyWord)) {
              matching = true
              return false
            }
          })
        }

        return matching
      })

    list.forEach((data) => {
      if (data[TS].date !== prevDate) {
        $('.panel').append(`
          <a class="panel-block panel-date ">
          <span class="panel-icon">
          <i class="far fa-calendar-alt" aria-hidden="true"></i>
          </span>
          <small>${data[TS].date} (${data.week})</small>
          </a>            
        `)
      }

      $('.panel').append(`
				<a class="panel-block data-item" data-idx="${data.idx}">
				    <span class="panel-icon">
				      <i class="${data.listClass}" aria-hidden="true"></i>
				    </span>
				    <small>${data.more.name} [${data.fileName}]</small>
				    <span class="panel-price is-pulled-right ${data.payClass}">
				        ${data.paySymbol}${data.viewPrice}<small>원</small>
				    </span>
				</a>
      `)

      prevDate = data[TS].date
    })

    if (list.length) {
      const item = list.filter((el) => el.idx === this.active)

      if (this.active === false || !item.length)
        this.active = $('.data-item').eq(0).data('idx')

      this.activeChange(this.active)
    } else {
      $('.detail').html(
        '<div class="detail-content content"><p>검색 결과가 없습니다.</p></div>'
      )
    }
  },

  activeChange(idx) {
    this.active = idx

    $('.data-item').removeClass('is-active')
    $(`.data-item[data-idx=${idx}]`).addClass('is-active')

    this.viewDetail()
  },

  search() {
    this.keyWord = $('.input').val()
    dd(this.keyWord)
    this.refresh()
  },

  viewDetail() {
    const { list } = Local.get

    let item = list.filter((el) => el.idx === this.active)[0]

    let btn = this.detail ? '일반보기' : '상세보기'

    this.activeItem = item
    item = getInfo(item)

    let type = item.cardLabel === '마스터카드' ? 'card-master' : 'card-visa'
    let v = getSearch(item)

    if (this.keyWord !== '') v = highright(v, this.keyWord)

    $('.detail-content').html(`
			<h1>
				${v.payType}
			    <a class="button is-pulled-right is-rounded">${btn}</a>
			</h1>
			<p>${v.viewDate}</p>
			<h3>
				${v.name}
			    <span class="is-pulled-right ${type}">
			        <i class="${v.cardClass}"></i>&nbsp;${v.cardLabel}
			    </span>
			</h3>
			<hr>
			<h1 class="is-marginless has-text-right">
			    <span class="is-pulled-left">거래금액</span>
			    <span class="has-text-danger">${v.viewPrice}<small>원</small></span>
			</h1>
    `)

    if (!this.detail) return

    $('.detail-content').append(`
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">거래시각</span>
			    <span>${v.viewDate}</span>
			</p>
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">거래구분</span>
			    <span>${v.payType}</span>
			</p>
			<p class="has-text-right">
			    <span class="is-pulled-left">거래형태</span>
			    <span>${v.payPlace}</span>
			</p>
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">카드정보</span>
			    <span>${v.cardLabel}</span>
			</p>
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">카드번호</span>
			    <span>${v.cardNum}</span>
			</p>
			<p class="has-text-right">
			    <span class="is-pulled-left">승인번호</span>
			    <span>${v.cardApp}</span>
			</p>
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">사용처</span>
			    <span>${v.name}</span>
			</p>
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">주소</span>
			    <span>${v.address}</span>
			</p>
			<p class="is-marginless has-text-right">
			    <span class="is-pulled-left">전화번호</span>
			    <span>${v.phone}</span>
			</p>
    `)
  },

  export() {
    const a = document.createElement('a')
    const datas = JSON.parse(LS.getItem('Receipt'))
    const data = datas.filter((el) => el.idx === $('.is-active').data('idx'))[0]
    const fileName = data.fileName
    delete data.fileName
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    a.style = 'display: none;'
    a.href = url
    a.download = fileName
    $('body').prepend(a)
    a.click()
    URL.revokeObjectURL(url)
  },

  delete() {
    let datas = JSON.parse(LS.getItem('Receipt'))
    datas = datas.filter((el) => el.idx !== $('.is-active').data('idx'))

    Receipt.focused = Receipt.focused.filter(
      (el) => el !== $('.is-active').data('idx')
    )
    LS.setItem('Receipt', JSON.stringify(datas))
    Popup.list()
    Receipt.refresh()
  },
}

/* 팝업창 관련 기능들 */
const Popup = {
  receiptList: [],
  receiptNone: '',
  focusList: [],
  init() {
    this.receiptNone = `
      <tr>
        <td class="has-text-centered">
          <span>파일을 선택하면 여기에 추가됩니다.</span>
        </td>
      </tr>
    `

    $('#radio-png, #radio-png2').val('png')
    $('#radio-jpg, #radio-jpg2').val('jpg')

    $('body').prepend('<input type="file" id="addFile" multiple hidden/>')
    Popup.handle()
  },

  handle() {
    $(document)
      // 팝업버튼클릭시
      .on('click', 'a[data-target]', function () {
        Popup.open($(this).data('target'))
      })
      // 팝업 닫기 클릭시
      .on('click', '.modal-close', function () {
        Popup.close(false)
      })
      // 추가 버튼 클릭시
      .on(
        'click',
        '#Receipt > div.modal-card > footer > button:nth-child(1)',
        function () {
          $('#addFile').val('').click()
        }
      )
      // 파일 업로드 시
      .on('change', '#addFile', function () {
        Popup.fileUpload(this.files)
      })
      // 업로드 & 저장 클릭시
      .on('click', '#Receipt .is-success', function () {
        Popup.saveFile()
      })
      /* 초기화 버튼 클릭시 */
      .on('click', '#Initialization .is-danger', function () {
        const { list } = Local.get
        Local.set({
          idx: 0,
          list: [],
        })
        Popup.close()
      })
      // 선택 내보내기 버튼 클릭시
      .on('click', '#Export footer button', () => {
        Popup.exportList()
      })
      // 선택 다운로드 버튼 클릭시
      .on('click', '#Download footer button', () => {
        Popup.downloadList()
      })
      // 디테일 다운로드 버튼 클릭시
      .on('click', '#DetailDownload .is-success', () => {
        const ext = $('input[name=radio-download2]:checked').val()
        Popup.download(Receipt.activeItem, ext)
      })
      // 선택 삭제 버튼 클릭시
      .on('click', '#Delete footer button', function () {
        Popup.delete()
      })
      /* 선택 팝업창 공통 X 버튼 클릭시 */
      .on('click', '.focus-delete', function () {
        const item = Popup.focusList.splice($(this).data('idx'), 1)[0]
        $(`.is-focused[data-idx=${item.idx}]`).removeClass('is-focused')
        Popup.focusRefresh()
      })
      // 추가 팝업창 에서 추가한 요소 x버튼 클릭시
      .on('click', '#Receipt .delete', function () {
        Popup.receiptList.splice($(this).data('idx'), 1)
        Popup.refresh()
      })
  },

  open(target) {
    const { list } = Local.get

    this.target = target
    this.focusList = []
    $('#' + target).css('display', 'flex')

    $('.is-focused').each((idx, el) => {
      const item = list.filter((data) => data.idx === +el.dataset.idx)[0]
      this.focusList.push(item)
    })

    if (typeof this[target + 'Init'] === 'function') {
      this[target + 'Init']()
    }
  },

  close(refresh = true) {
    $('#' + this.target).hide()
    if (refresh) Receipt.refresh()
  },

  /* 추가 팝업창 새로 로딩  */
  refresh() {
    $('#Receipt table tbody').html(
      this.receiptList.length === 0 ? this.receiptNone : ''
    )
    $('#Receipt .is-success').attr('disabled', this.receiptList.length === 0)

    this.receiptList.forEach((file, idx) =>
      $('#Receipt table tbody').append(`
      <tr>
        <td>
          <a>${file.name} <span class="tag is-info">${Math.ceil(
        file.size / 1024
      )}Kb</span></a>
          <button class="delete is-pulled-right" aria-label="close" data-idx=${idx}></button>
        </td>
      </tr>
    `)
    )
  },

  /* 선택된 영수증 목록 새로 로딩 */
  focusRefresh() {
    const $table = $('#' + this.target).find('tbody')
    const $button = $('#' + this.target).find('.is-success')

    $table.html(
      this.focusList.length === 0
        ? `                <tr>
                    <td class="has-text-centered">
                        <strong class="has-text-danger">1개 이상 선택하세요.</strong>
                    </td>
                </tr>`
        : `<tr>
                    <td class="has-text-centered">
                        <span>총 <strong>${this.focusList.length}</strong>개의 영수증이 선택되었습니다.</span>
                    </td>
                </tr>`
    )

    $button.attr('disabled', this.focusList.length === 0)

    this.focusList.forEach((data, idx) => {
      $table.append(`
          <tr>
            <td>
              <a>${data.fileName} <span class="tag is-info">${Math.ceil(
        data.fileSize / 1024
      )}Kb</span></a>
              <button class="delete focus-delete is-pulled-right" aria-label="close" data-idx=${idx}></button>
            </td>
          </tr>        
      `)
    })
  },

  /* 선택 내보내기 초기화 */
  ExportInit() {
    this.focusRefresh()
  },

  /* 선택 다운로드 초기화 */
  DownloadInit() {
    this.focusRefresh()
  },

  /* 선택 삭제 초기화 */
  DeleteInit() {
    this.focusRefresh()
  },

  /* 초기화 팝업 초기화 */
  InitializationInit() {
    const { list } = Local.get
    $('#Initialization span strong').text(list.length)
    $('#Initialization .is-danger').attr('disabled', list.length === 0)
  },

  fileUpload(files) {
    const fileList = [...files].filter(
      (el) => el.name.substr(-5).toLowerCase() === '.json'
    )
    if (fileList.length !== files.length) {
      alert('json 파일만 선택 할 수 있습니다.')
      return false
    }

    this.receiptList = [...this.receiptList, ...fileList]
    this.refresh()
  },

  saveFile() {
    const datas = Local.get
    let result = 0

    this.receiptList.forEach((file) => {
      let fr = new FileReader()

      fr.onload = (e) => {
        datas.list.push({
          idx: ++datas.idx,
          fileSize: file.size,
          fileName: file.name,
          content: JSON.parse(e.target.result),
        })

        result++

        if (this.receiptList.length === result) {
          Local.set(datas)
          this.receiptList = []
          this.refresh()
          Popup.close()
        }
      }

      fr.readAsText(file)
    })
  },

  exportList() {
    this.focusList.forEach((file) => this.exportFile(file))
  },

  exportFile(file) {
    const a = document.createElement('a')
    const jsonData = JSON.stringify(file.content, null, '\t')
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = file.fileName
    a.click()

    URL.revokeObjectURL(url)
  },

  DetailDownloadInit() {
    $('#DetailDownload table tbody').html(`
			<tr>
          <td>
              <a>${
                Receipt.activeItem.fileName
              } <span class="tag is-info">${Math.ceil(
      Receipt.activeItem.fileSize / 1024
    )}Kb</span></a>
          </td>
      </tr>      
    `)
  },

  downloadList() {
    const ext = $('input[name=radio-download]:checked').val()

    this.focusList.forEach((file) => {
      this.download(file, ext)
    })
  },

  download(file, ext) {
    const data = getInfo(file)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    let address = data.more.address
    let line = '------------------------------------------------'
    let ct = 0

    canvas.width = 330
    canvas.height = 420

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 330, 420)

    ctx.fillStyle = '#000'
    ctx.font = '24px malgun gothic'
    ctx.textAlign = 'center'
    ctx.fillText('스마트영수증', 165, (ct += 40))

    ctx.font = '14px malgun gothic'
    ctx.textAlign = 'left'

    while (ctx.measureText(address).width > 254) {
      address = address.substr(0, address.length - 1)
    }

    ctx.fillText('사용처 : ' + data.more.name, 20, (ct += 35))
    ctx.fillText('가맹점번호 : ' + data.more.number, 20, (ct += 20))
    ctx.fillText('전화번호 : ' + data.more.call, 20, (ct += 20))
    ctx.fillText('주소 : ' + address, 20, (ct += 20))

    ctx.fillText(line, 20, (ct += 25))

    ctx.font = '20px malgun gothic'
    ctx.textAlign = 'center'
    ctx.fillText(`[ ${data.payPlace} ${data.payType} ]`, 165, (ct += 25))

    ctx.font = '14px malgun gothic'
    ctx.textAlign = 'left'
    ctx.fillText('카드종류 : ' + data.cardLabel, 20, (ct += 20))
    ctx.fillText('카드번호 : ' + data.card.number, 20, (ct += 20))
    ctx.fillText('거래승인 : ' + data.card.approval, 20, (ct += 20))
    ctx.fillText(
      '거래일시 : ' + data[TS].date + ' ' + data[TS].time,
      20,
      (ct += 20)
    )

    ctx.fillText(line, 20, (ct += 20))

    ctx.fillText('거래금액 :', 20, (ct += 20))
    ctx.textAlign = 'right'
    ctx.fillText(data[TS].amount * 0.95 + '원', 300, ct)

    ctx.textAlign = 'left'
    ctx.fillText('부가 :', 20, (ct += 20))
    ctx.textAlign = 'right'
    ctx.fillText(data[TS].amount * 0.05 + '원', 300, ct)

    ctx.textAlign = 'left'
    ctx.fillText('합계 :', 20, (ct += 20))
    ctx.textAlign = 'right'
    ctx.fillText(data.viewPrice + '원', 300, ct)

    ctx.textAlign = 'left'
    ctx.fillText(line, 20, (ct += 20))
    ctx.fillText('감사합니다!', 20, (ct += 20))

    const a = document.createElement('a')
    a.href = canvas.toDataURL(ext === 'jpg' ? 'image/jpeg' : 'image/png')
    a.download =
      '영수증' + data.fileName.slice(0, data.fileName.length - 5) + '.' + ext
    a.click()
  },

  delete() {
    let local = Local.get
    let idxs = this.focusList.col('idx')
    local.list = local.list.filter((el) => !idxs.includes(el.idx))
    Local.set(local)
    Popup.close()
  },
}

Local.def()

Receipt.init()
Popup.init()
