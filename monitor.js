import { chromium } from 'playwright';
import fs from 'node:fs';

const CONFIG = Object.freeze({
  siteUrl: 'https://tuboleto.cultura.pe/llaqta_machupicchu',

  requiredTickets: Number.parseInt(
    process.env.REQUIRED_TICKETS || '4',
    10
  ),

  notifyStatus:
    String(
      process.env.NOTIFY_STATUS || 'false'
    ).toLowerCase() === 'true',

  timeZone: 'America/Lima',
  stateFile: 'state.json',
  diagnosticDirectory: 'diagnostico',
  pageTimeoutMs: 60000,
  actionTimeoutMs: 30000
});


/* ============================================================
 * RUTAS
 * ============================================================
 */

const ROUTES = Object.freeze([
  {
    code: '1-A',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-A',
    name: 'Montaña Machupicchu'
  },
  {
    code: '1-B',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-B',
    name: 'Terraza Superior'
  },
  {
    code: '1-C',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-C',
    name: 'Portada Intipunku'
  },
  {
    code: '1-D',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-D',
    name: 'Puente Inka'
  },
  {
    code: '2-A',
    circuitText: 'Circuito 2',
    routeText: 'Ruta 2-A',
    name: 'Clásico Diseñada'
  },
  {
    code: '2-B',
    circuitText: 'Circuito 2',
    routeText: 'Ruta 2-B',
    name: 'Terraza Inferior'
  },
  {
    code: '3-A',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-A',
    name: 'Montaña Waynapicchu'
  },
  {
    code: '3-B',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-B',
    name: 'Realeza Diseñada'
  },
  {
    code: '3-C',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-C',
    name: 'Gran Caverna'
  },
  {
    code: '3-D',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-D',
    name: 'Huchuypicchu'
  }
]);


/* ============================================================
 * MESES
 * ============================================================
 */

const MONTHS = Object.freeze({
  ENE: 0,
  ENERO: 0,
  JAN: 0,

  FEB: 1,
  FEBRERO: 1,

  MAR: 2,
  MARZO: 2,

  ABR: 3,
  ABRIL: 3,
  APR: 3,

  MAY: 4,
  MAYO: 4,

  JUN: 5,
  JUNIO: 5,

  JUL: 6,
  JULIO: 6,

  AGO: 7,
  AGOSTO: 7,
  AUG: 7,

  SET: 8,
  SEP: 8,
  SEPT: 8,
  SEPTIEMBRE: 8,

  OCT: 9,
  OCTUBRE: 9,

  NOV: 10,
  NOVIEMBRE: 10,

  DIC: 11,
  DICIEMBRE: 11,
  DEC: 11
});


const SPANISH_MONTHS = Object.freeze([
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]);


/* ============================================================
 * FECHAS Y TEXTO
 * ============================================================
 */

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function getDatePartsInLima(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          CONFIG.timeZone,

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit'
      }
    ).formatToParts(date);

  const values = {};

  for (
    const part of parts
  ) {
    if (
      [
        'year',
        'month',
        'day'
      ].includes(part.type)
    ) {
      values[part.type] =
        Number(part.value);
    }
  }

  return {
    year:
      values.year,

    month:
      values.month,

    day:
      values.day
  };
}


/**
 * Calcula automáticamente mañana
 * usando la fecha de Lima, Perú.
 */
function getTomorrowInLima() {
  const today =
    getDatePartsInLima();

  const tomorrow =
    new Date(
      Date.UTC(
        today.year,
        today.month - 1,
        today.day + 1
      )
    );

  const year =
    tomorrow.getUTCFullYear();

  const month =
    tomorrow.getUTCMonth() + 1;

  const day =
    tomorrow.getUTCDate();

  return {
    iso:
      String(year).padStart(4, '0') +
      '-' +
      String(month).padStart(2, '0') +
      '-' +
      String(day).padStart(2, '0'),

    date:
      tomorrow
  };
}


function formatDatePE(
  isoDate
) {
  const [
    year,
    month,
    day
  ] = isoDate.split('-');

  return (
    day +
    '/' +
    month +
    '/' +
    year
  );
}


function getLimaTimestamp() {
  return new Intl.DateTimeFormat(
    'es-PE',
    {
      timeZone:
        CONFIG.timeZone,

      dateStyle:
        'short',

      timeStyle:
        'medium'
    }
  ).format(
    new Date()
  );
}


function parseCalendarMonth(
  label
) {
  const cleanLabel =
    normalizeText(label)
      .toUpperCase()
      .replace(
        /\./g,
        ''
      );

  const parts =
    cleanLabel.split(' ');

  if (
    parts.length < 2
  ) {
    return null;
  }

  const month =
    MONTHS[parts[0]];

  const year =
    Number.parseInt(
      parts[
        parts.length - 1
      ],
      10
    );

  if (
    month === undefined ||
    !Number.isInteger(year)
  ) {
    return null;
  }

  return {
    month,
    year
  };
}


/* ============================================================
 * VALIDACIÓN
 * ============================================================
 */

function validateConfiguration() {
  if (
    !Number.isInteger(
      CONFIG.requiredTickets
    ) ||
    CONFIG.requiredTickets < 1
  ) {
    throw new Error(
      'REQUIRED_TICKETS debe ser un número entero mayor que cero.'
    );
  }

  if (
    ROUTES.length === 0
  ) {
    throw new Error(
      'No existen rutas configuradas.'
    );
  }
}


/* ============================================================
 * DIAGNÓSTICO
 * ============================================================
 */

function ensureDiagnosticDirectory() {
  fs.mkdirSync(
    CONFIG.diagnosticDirectory,
    {
      recursive: true
    }
  );
}


function sanitizeFileName(
  value
) {
  return normalizeText(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}


async function saveDiagnostic(
  page,
  name
) {
  ensureDiagnosticDirectory();

  const safeName =
    sanitizeFileName(name);

  await page
    .screenshot({
      path:
        CONFIG.diagnosticDirectory +
        '/' +
        safeName +
        '.png',

      fullPage:
        true
    })
    .catch(
      error => {
        console.warn(
          'No se pudo guardar ' +
          safeName +
          '.png:',
          error.message
        );
      }
    );
}


/* ============================================================
 * ESTADO DEL MONITOR
 * ============================================================
 */

function loadState() {
  try {
    if (
      !fs.existsSync(
        CONFIG.stateFile
      )
    ) {
      return {
        targetDate: '',
        availableKeys: [],
        allRoutesFailed: false
      };
    }

    const state =
      JSON.parse(
        fs.readFileSync(
          CONFIG.stateFile,
          'utf8'
        )
      );

    return {
      targetDate:
        String(
          state.targetDate || ''
        ),

      availableKeys:
        Array.isArray(
          state.availableKeys
        )
          ? state.availableKeys.map(
            String
          )
          : [],

      allRoutesFailed:
        state.allRoutesFailed ===
        true
    };

  } catch (error) {
    console.warn(
      'No se pudo leer state.json:',
      error.message
    );

    return {
      targetDate: '',
      availableKeys: [],
      allRoutesFailed: false
    };
  }
}


function saveState(
  targetDate,
  availableItems,
  allRoutesFailed
) {
  const state = {
    targetDate,

    availableKeys:
      availableItems
        .map(
          item =>
            item.key
        )
        .sort(),

    allRoutesFailed:
      allRoutesFailed === true,

    lastCheck:
      new Date().toISOString()
  };

  fs.writeFileSync(
    CONFIG.stateFile,
    JSON.stringify(
      state,
      null,
      2
    ) + '\n',
    'utf8'
  );
}


/* ============================================================
 * TELEGRAM
 * ============================================================
 */

function splitTelegramMessage(
  text,
  maxLength = 3900
) {
  const chunks = [];

  let remaining =
    String(text || '');

  while (
    remaining.length >
    maxLength
  ) {
    let splitAt =
      remaining.lastIndexOf(
        '\n',
        maxLength
      );

    if (
      splitAt <
      Math.floor(
        maxLength * 0.6
      )
    ) {
      splitAt =
        maxLength;
    }

    chunks.push(
      remaining
        .slice(
          0,
          splitAt
        )
        .trim()
    );

    remaining =
      remaining
        .slice(splitAt)
        .trim();
  }

  if (
    remaining
  ) {
    chunks.push(
      remaining
    );
  }

  return chunks;
}


async function sendTelegram(
  text
) {
  const token =
    process.env.BOT_TOKEN;

  const chatId =
    process.env.CHAT_ID;

  if (
    !token ||
    !chatId
  ) {
    throw new Error(
      'No se encontraron BOT_TOKEN o CHAT_ID.'
    );
  }

  const chunks =
    splitTelegramMessage(
      text
    );

  for (
    const chunk of chunks
  ) {
    const response =
      await fetch(
        'https://api.telegram.org/bot' +
        token +
        '/sendMessage',

        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              chat_id:
                chatId,

              text:
                chunk,

              disable_web_page_preview:
                false
            })
        }
      );

    const responseText =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        'Telegram respondió HTTP ' +
        response.status +
        ': ' +
        responseText
      );
    }

    const result =
      JSON.parse(
        responseText
      );

    if (
      !result.ok
    ) {
      throw new Error(
        'Telegram rechazó el mensaje: ' +
        responseText
      );
    }
  }
}


/* ============================================================
 * CARGA DE TU BOLETO
 * ============================================================
 */

async function waitForPageReady(
  page
) {
  await page
    .getByText(
      'Adquiere tu boleto',
      {
        exact: false
      }
    )
    .waitFor({
      state:
        'visible',

      timeout:
        CONFIG.pageTimeoutMs
    });

  await page.waitForFunction(
    () => {
      const visibleSelects =
        Array
          .from(
            document.querySelectorAll(
              'mat-select'
            )
          )
          .filter(
            element => {
              const rect =
                element
                  .getBoundingClientRect();

              const style =
                window
                  .getComputedStyle(
                    element
                  );

              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !==
                  'hidden' &&
                style.display !==
                  'none'
              );
            }
          );

      return (
        visibleSelects.length >= 2
      );
    },
    null,
    {
      timeout:
        CONFIG.pageTimeoutMs
    }
  );
}


/* ============================================================
 * CAMPOS Y OPCIONES
 * ============================================================
 */

async function findFormField(
  page,
  keyword
) {
  const fields =
    page.locator(
      'mat-form-field'
    );

  const count =
    await fields.count();

  const normalizedKeyword =
    normalizeText(keyword)
      .toLowerCase();

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const field =
      fields.nth(index);

    if (
      !await field
        .isVisible()
        .catch(
          () => false
        )
    ) {
      continue;
    }

    const text =
      normalizeText(
        await field
          .innerText()
          .catch(
            () => ''
          )
      ).toLowerCase();

    if (
      text.includes(
        normalizedKeyword
      )
    ) {
      return field;
    }
  }

  throw new Error(
    'No se encontró el campo: ' +
    keyword
  );
}


async function waitForSelectEnabled(
  select
) {
  for (
    let attempt = 0;
    attempt < 60;
    attempt++
  ) {
    const ariaDisabled =
      await select.getAttribute(
        'aria-disabled'
      );

    const disabled =
      await select.getAttribute(
        'disabled'
      );

    if (
      ariaDisabled !== 'true' &&
      disabled === null
    ) {
      return;
    }

    await select
      .page()
      .waitForTimeout(
        500
      );
  }

  throw new Error(
    'El selector continuó deshabilitado.'
  );
}


async function waitForVisibleOptions(
  page
) {
  await page.waitForFunction(
    () => {
      const options =
        Array.from(
          document.querySelectorAll(
            '[role="option"], mat-option'
          )
        );

      return options.some(
        element => {
          const rect =
            element
              .getBoundingClientRect();

          const style =
            window
              .getComputedStyle(
                element
              );

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !==
              'hidden' &&
            style.display !==
              'none'
          );
        }
      );
    },
    null,
    {
      timeout:
        CONFIG.actionTimeoutMs
    }
  );
}


async function getVisibleOptions(
  page
) {
  const candidates =
    page.locator(
      '[role="option"], mat-option'
    );

  const count =
    await candidates.count();

  const visible = [];

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const candidate =
      candidates.nth(index);

    if (
      await candidate
        .isVisible()
        .catch(
          () => false
        )
    ) {
      visible.push(
        candidate
      );
    }
  }

  return visible;
}


async function selectMatOption(
  page,
  fieldKeyword,
  optionText
) {
  const field =
    await findFormField(
      page,
      fieldKeyword
    );

  const select =
    field
      .locator(
        'mat-select'
      )
      .first();

  await select.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  await waitForSelectEnabled(
    select
  );

  await select
    .scrollIntoViewIfNeeded();

  await select.click({
    force: true
  });

  await waitForVisibleOptions(
    page
  );

  const options =
    await getVisibleOptions(
      page
    );

  const normalizedTarget =
    normalizeText(optionText)
      .toLowerCase();

  const descriptions = [];

  let selectedOption =
    null;

  for (
    const option of options
  ) {
    const fullText =
      normalizeText(
        await option
          .innerText()
          .catch(
            () => ''
          )
      );

    descriptions.push(
      fullText
    );

    if (
      fullText
        .toLowerCase()
        .includes(
          normalizedTarget
        )
    ) {
      selectedOption =
        option;

      break;
    }
  }

  if (
    !selectedOption
  ) {
    await page.keyboard
      .press('Escape')
      .catch(
        () => {}
      );

    throw new Error(
      'No se encontró "' +
      optionText +
      '". Opciones: ' +
      descriptions.join(' | ')
    );
  }

  const ariaDisabled =
    await selectedOption
      .getAttribute(
        'aria-disabled'
      );

  const disabled =
    await selectedOption
      .getAttribute(
        'disabled'
      );

  const className =
    String(
      await selectedOption
        .getAttribute(
          'class'
        ) || ''
    );

  if (
    ariaDisabled === 'true' ||
    disabled !== null ||
    className.includes(
      'option-disabled'
    )
  ) {
    await page.keyboard
      .press('Escape')
      .catch(
        () => {}
      );

    console.log(
      'La opción ' +
      optionText +
      ' está deshabilitada.'
    );

    return false;
  }

  console.log(
    'Seleccionando:',
    normalizeText(
      await selectedOption.innerText()
    )
  );

  await selectedOption.click({
    force: true
  });

  await page.waitForTimeout(
    900
  );

  return true;
}


/* ============================================================
 * CALENDARIO
 * ============================================================
 */

async function openTargetCalendar(
  page
) {
  const dateField =
    await findFormField(
      page,
      'fecha'
    );

  const input =
    dateField
      .locator('input')
      .first();

  await input.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  const calendar =
    page.locator(
      'mat-calendar:visible'
    );

  if (
    !await calendar
      .isVisible()
      .catch(
        () => false
      )
  ) {
    await input.click({
      force: true
    });
  }

  await calendar.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });
}


async function navigateCalendarToTargetMonth(
  page,
  targetDate
) {
  const targetYear =
    targetDate.getUTCFullYear();

  const targetMonth =
    targetDate.getUTCMonth();

  const periodButton =
    page.locator(
      '.mat-calendar-period-button:visible'
    );

  await periodButton.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  for (
    let attempt = 0;
    attempt < 24;
    attempt++
  ) {
    const label =
      await periodButton.innerText();

    const current =
      parseCalendarMonth(
        label
      );

    if (
      !current
    ) {
      throw new Error(
        'No se pudo interpretar el mes visible: ' +
        label
      );
    }

    const difference =
      (
        targetYear -
        current.year
      ) * 12 +
      (
        targetMonth -
        current.month
      );

    if (
      difference === 0
    ) {
      await page.waitForTimeout(
        1200
      );

      return;
    }

    const navigationButton =
      difference > 0
        ? page.locator(
          '.mat-calendar-next-button:visible'
        )
        : page.locator(
          '.mat-calendar-previous-button:visible'
        );

    const monthResponse =
      page
        .waitForResponse(
          response =>
            response
              .url()
              .includes(
                '/visita/consulta-fechas-disponibles'
              ) &&
            response
              .request()
              .method() ===
              'POST',

          {
            timeout:
              CONFIG.actionTimeoutMs
          }
        )
        .catch(
          () => null
        );

    await navigationButton.click({
      force: true
    });

    await monthResponse;

    await page.waitForTimeout(
      700
    );
  }

  throw new Error(
    'No se pudo llegar al mes objetivo.'
  );
}


async function selectTargetDay(
  page,
  targetDate
) {
  const targetDay =
    targetDate.getUTCDate();

  const targetMonth =
    targetDate.getUTCMonth();

  const targetYear =
    targetDate.getUTCFullYear();

  const monthName =
    SPANISH_MONTHS[
      targetMonth
    ];

  const candidates =
    page.locator(
      'mat-calendar:visible button.mat-calendar-body-cell'
    );

  const count =
    await candidates.count();

  let targetCell =
    null;

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const candidate =
      candidates.nth(index);

    const text =
      normalizeText(
        await candidate
          .innerText()
          .catch(
            () => ''
          )
      );

    if (
      text !==
      String(targetDay)
    ) {
      continue;
    }

    if (
      !targetCell
    ) {
      targetCell =
        candidate;
    }

    const ariaLabel =
      normalizeText(
        await candidate
          .getAttribute(
            'aria-label'
          )
      ).toLowerCase();

    if (
      ariaLabel.includes(
        String(targetYear)
      ) &&
      ariaLabel.includes(
        monthName
      )
    ) {
      targetCell =
        candidate;

      break;
    }
  }

  if (
    !targetCell
  ) {
    throw new Error(
      'No se encontró el día ' +
      targetDay +
      ' en el calendario.'
    );
  }

  const ariaDisabled =
    await targetCell.getAttribute(
      'aria-disabled'
    );

  const disabledAttribute =
    await targetCell.getAttribute(
      'disabled'
    );

  const className =
    String(
      await targetCell.getAttribute(
        'class'
      ) || ''
    );

  const disabled =
    ariaDisabled === 'true' ||
    disabledAttribute !== null ||
    className.includes(
      'mat-calendar-body-disabled'
    ) ||
    await targetCell
      .isDisabled()
      .catch(
        () => false
      );

  if (
    disabled
  ) {
    console.log(
      'La fecha está deshabilitada.'
    );

    return false;
  }

  await targetCell.click({
    force: true
  });

  await page.waitForTimeout(
    1400
  );

  return true;
}


/* ============================================================
 * HORARIOS
 * ============================================================
 */

async function readAvailableSlots(
  page
) {
  let scheduleField;

  try {
    scheduleField =
      await findFormField(
        page,
        'horario'
      );

  } catch {
    console.log(
      'No apareció el campo de horarios.'
    );

    return [];
  }

  const select =
    scheduleField
      .locator(
        'mat-select'
      )
      .first();

  await select.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  await waitForSelectEnabled(
    select
  );

  await select.click({
    force: true
  });

  await waitForVisibleOptions(
    page
  );

  const options =
    await getVisibleOptions(
      page
    );

  const slots = [];

  for (
    const option of options
  ) {
    const text =
      normalizeText(
        await option
          .innerText()
          .catch(
            () => ''
          )
      );

    const ariaDisabled =
      await option.getAttribute(
        'aria-disabled'
      );

    const className =
      String(
        await option.getAttribute(
          'class'
        ) || ''
      );

    const disabled =
      ariaDisabled === 'true' ||
      className.includes(
        'option-disabled'
      );

    const timeMatch =
      text.match(
        /(\d{1,2}:\d{2})/
      );

    const seatsMatch =
      text.match(
        /(\d+)\s+(?:boletos?|entradas?|cupos?)/i
      );

    console.log(
      'Horario observado:',
      text
    );

    if (
      !timeMatch ||
      !seatsMatch
    ) {
      continue;
    }

    slots.push({
      time:
        timeMatch[1],

      seats:
        Number.parseInt(
          seatsMatch[1],
          10
        ),

      disabled,

      text
    });
  }

  await page.keyboard
    .press('Escape')
    .catch(
      () => {}
    );

  return slots;
}


/* ============================================================
 * REVISIÓN DE UNA RUTA
 * ============================================================
 */

async function checkRoute(
  context,
  route,
  target
) {
  const page =
    await context.newPage();

  page.setDefaultTimeout(
    CONFIG.actionTimeoutMs
  );

  page.on(
    'requestfailed',
    request => {
      console.warn(
        'Solicitud fallida:',
        request.url(),
        request.failure()
          ?.errorText || ''
      );
    }
  );

  try {
    console.log(
      '\n===================================='
    );

    console.log(
      'Revisando ruta ' +
      route.code +
      ': ' +
      route.name
    );

    await page.goto(
      CONFIG.siteUrl,
      {
        waitUntil:
          'domcontentloaded',

        timeout:
          CONFIG.pageTimeoutMs
      }
    );

    await waitForPageReady(
      page
    );

    const circuitSelected =
      await selectMatOption(
        page,
        'circuito',
        route.circuitText
      );

    if (
      !circuitSelected
    ) {
      return {
        route,
        processed: true,
        routeEnabled: false,
        dateEnabled: false,
        slots: [],
        matchingSlots: [],
        error: null
      };
    }

    const initialDatesResponse =
      page
        .waitForResponse(
          response =>
            response
              .url()
              .includes(
                '/visita/consulta-fechas-disponibles'
              ) &&
            response
              .request()
              .method() ===
              'POST',

          {
            timeout:
              CONFIG.actionTimeoutMs
          }
        )
        .catch(
          () => null
        );

    const routeSelected =
      await selectMatOption(
        page,
        'ruta',
        route.routeText
      );

    if (
      !routeSelected
    ) {
      return {
        route,
        processed: true,
        routeEnabled: false,
        dateEnabled: false,
        slots: [],
        matchingSlots: [],
        error: null
      };
    }

    await initialDatesResponse;

    await openTargetCalendar(
      page
    );

    await navigateCalendarToTargetMonth(
      page,
      target.date
    );

    const dateEnabled =
      await selectTargetDay(
        page,
        target.date
      );

    if (
      !dateEnabled
    ) {
      return {
        route,
        processed: true,
        routeEnabled: true,
        dateEnabled: false,
        slots: [],
        matchingSlots: [],
        error: null
      };
    }

    const slots =
      await readAvailableSlots(
        page
      );

    const matchingSlots =
      slots.filter(
        slot =>
          !slot.disabled &&
          slot.seats >=
            CONFIG.requiredTickets
      );

    return {
      route,
      processed: true,
      routeEnabled: true,
      dateEnabled: true,
      slots,
      matchingSlots,
      error: null
    };

  } catch (error) {
    console.error(
      'Error en ruta ' +
      route.code +
      ':',
      error.message
    );

    await saveDiagnostic(
      page,
      'error-' +
      route.code
    );

    return {
      route,
      processed: false,
      routeEnabled: false,
      dateEnabled: false,
      slots: [],
      matchingSlots: [],
      error:
        error.message
    };

  } finally {
    await page.close();
  }
}


/* ============================================================
 * MENSAJES DE RESULTADO
 * ============================================================
 */

function groupAvailabilityByRoute(
  availableItems
) {
  const groups =
    new Map();

  for (
    const item of availableItems
  ) {
    if (
      !groups.has(
        item.route.code
      )
    ) {
      groups.set(
        item.route.code,
        {
          route:
            item.route,

          slots:
            []
        }
      );
    }

    groups
      .get(
        item.route.code
      )
      .slots
      .push(
        item
      );
  }

  return Array.from(
    groups.values()
  );
}


function buildAvailabilityBody(
  targetDate,
  availableItems
) {
  const routeSections =
    groupAvailabilityByRoute(
      availableItems
    )
      .map(
        group => {
          const slotsText =
            group.slots
              .map(
                item =>
                  '• ' +
                  item.time +
                  ' — ' +
                  item.seats +
                  (
                    item.seats === 1
                      ? ' cupo'
                      : ' cupos'
                  )
              )
              .join('\n');

          return (
            'Ruta ' +
            group.route.code +
            ' — ' +
            group.route.name +
            '\n' +
            slotsText
          );
        }
      )
      .join('\n\n');

  return (
    'Fecha: ' +
    formatDatePE(
      targetDate
    ) +
    '\n' +
    'Cantidad mínima: ' +
    CONFIG.requiredTickets +
    '\n\n' +
    routeSections
  );
}


function buildAvailabilityMessage(
  targetDate,
  availableItems
) {
  return (
    '🚨 ENTRADAS LIBERADAS PARA MAÑANA\n\n' +
    buildAvailabilityBody(
      targetDate,
      availableItems
    ) +
    '\n\nCompra inmediatamente en:\n' +
    CONFIG.siteUrl +
    '\n\nDetectado: ' +
    getLimaTimestamp()
  );
}


function buildManualSummary(
  targetDate,
  results,
  availableItems
) {
  const processedCount =
    results.filter(
      result =>
        result.processed
    ).length;

  const errorResults =
    results.filter(
      result =>
        !result.processed
    );

  const disabledRoutes =
    results.filter(
      result =>
        result.processed &&
        !result.routeEnabled
    );

  const availabilityText =
    availableItems.length > 0
      ? (
        'Se encontraron cupos:\n\n' +
        buildAvailabilityBody(
          targetDate,
          availableItems
        )
      )
      : (
        'No se encontraron rutas con al menos ' +
        CONFIG.requiredTickets +
        ' cupos disponibles.'
      );

  const notes = [];

  if (
    disabledRoutes.length > 0
  ) {
    notes.push(
      'Rutas no habilitadas en el portal: ' +
      disabledRoutes
        .map(
          result =>
            result.route.code
        )
        .join(', ')
    );
  }

  if (
    errorResults.length > 0
  ) {
    notes.push(
      'Rutas con error: ' +
      errorResults
        .map(
          result =>
            result.route.code
        )
        .join(', ')
    );
  }

  return (
    '🔎 REVISIÓN MANUAL COMPLETADA\n\n' +
    'Fecha vigilada: ' +
    formatDatePE(
      targetDate
    ) +
    '\n' +
    'Rutas procesadas: ' +
    processedCount +
    ' de ' +
    ROUTES.length +
    '\n\n' +
    availabilityText +
    (
      notes.length > 0
        ? (
          '\n\n' +
          notes.join('\n')
        )
        : ''
    ) +
    '\n\nRevisado: ' +
    getLimaTimestamp()
  );
}


/* ============================================================
 * EJECUCIÓN PRINCIPAL
 * ============================================================
 */

async function main() {
  validateConfiguration();
  ensureDiagnosticDirectory();

  const target =
    getTomorrowInLima();

  console.log(
    'Fecha de mañana en Perú:',
    target.iso
  );

  const previousState =
    loadState();

  const previousKeys =
    previousState.targetDate ===
    target.iso
      ? new Set(
        previousState.availableKeys
      )
      : new Set();

  const browser =
    await chromium.launch({
      headless: true
    });

  const context =
    await browser.newContext({
      locale:
        'es-PE',

      timezoneId:
        CONFIG.timeZone,

      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/149.0.0.0 Safari/537.36',

      viewport: {
        width:
          1440,

        height:
          1100
      },

      extraHTTPHeaders: {
        'Accept-Language':
          'es-PE,es;q=0.9,en;q=0.8'
      }
    });

  try {
    const results = [];

    /*
     * Revisa las rutas una por una para no
     * sobrecargar el portal.
     */
    for (
      const route of ROUTES
    ) {
      const result =
        await checkRoute(
          context,
          route,
          target
        );

      results.push(
        result
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            700
          )
      );
    }

    const availableItems = [];

    for (
      const result of results
    ) {
      for (
        const slot of
        result.matchingSlots
      ) {
        availableItems.push({
          key:
            result.route.code +
            '|' +
            slot.time,

          route:
            result.route,

          time:
            slot.time,

          seats:
            slot.seats
        });
      }
    }

    availableItems.sort(
      (a, b) =>
        a.key.localeCompare(
          b.key
        )
    );

    const newAvailableItems =
      availableItems.filter(
        item =>
          !previousKeys.has(
            item.key
          )
      );

    const processedRoutes =
      results.filter(
        result =>
          result.processed
      );

    const allRoutesFailed =
      processedRoutes.length === 0;

    console.log(
      JSON.stringify(
        {
          targetDate:
            target.iso,

          processedRoutes:
            processedRoutes.length,

          availableItems,

          newAvailableItems
        },
        null,
        2
      )
    );

    /*
     * Una ejecución manual siempre informa
     * el resultado completo.
     */
    if (
      CONFIG.notifyStatus
    ) {
      await sendTelegram(
        buildManualSummary(
          target.iso,
          results,
          availableItems
        )
      );

    /*
     * Una ejecución automática solo avisa
     * cuando aparece disponibilidad nueva.
     */
    } else if (
      newAvailableItems.length > 0
    ) {
      await sendTelegram(
        buildAvailabilityMessage(
          target.iso,
          availableItems
        )
      );

      console.log(
        'Alerta de disponibilidad enviada.'
      );

    } else {
      console.log(
        'No existen nuevas disponibilidades.'
      );
    }

    if (
      allRoutesFailed &&
      !previousState.allRoutesFailed
    ) {
      await sendTelegram(
        '⚠️ EL MONITOR NO PUDO REVISAR TU BOLETO\n\n' +
        'Ninguna ruta pudo procesarse en esta ejecución.\n' +
        'Revisa GitHub Actions y los archivos de diagnóstico.\n\n' +
        'Hora: ' +
        getLimaTimestamp()
      );
    }

    saveState(
      target.iso,
      availableItems,
      allRoutesFailed
    );

    if (
      allRoutesFailed
    ) {
      process.exitCode = 1;
    }

  } finally {
    await context.close();
    await browser.close();
  }
}


await main();
