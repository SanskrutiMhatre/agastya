<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Page Setup Module
     
     Contains page layout masters and page sequence definitions.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">
    <!-- ==================================================================== -->
    <!--                         LAYOUT MASTER SET                             -->
    <!-- ==================================================================== -->
    <xsl:template name="layout-master-set">
        <fo:layout-master-set>
            <!-- Blank page master -->
            <fo:simple-page-master master-name="blank" 
          page-width="{$page-width}" 
          page-height="{$page-height}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-outer}" 
          margin-right="{$margin-inner}">
                <!-- The "intentionally left blank" legend arrives as a
                     background-image: these pages are inserted by FOP with no
                     flow content, and the XSL-FO spec forbids fo:static-content
                     from targeting region-body, so a background is the only
                     place the text can come from. Path is relative to the
                     project directory, which is FOP's working directory. -->
                <fo:region-body display-align="center"
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            background-image="url('{$blank.page.svg}')"
            background-repeat="no-repeat"
            background-position-horizontal="center"
            background-position-vertical="center"/>
                <fo:region-before region-name="xsl-region-before-blank"
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-blank" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <!-- First page master -->
            <fo:simple-page-master master-name="body-first" 
          page-width="{$page-width}" 
          page-height="{$page-height}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-inner}" 
          margin-right="{$margin-outer}">
                <fo:region-body 
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-first" 
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-first" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <!-- Odd page master -->
            <fo:simple-page-master master-name="body-odd" 
          page-width="{$page-width}" 
          page-height="{$page-height}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-inner}" 
          margin-right="{$margin-outer}">
                <fo:region-body 
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-odd" 
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-odd" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <!-- Even page master -->
            <fo:simple-page-master master-name="body-even" 
          page-width="{$page-width}" 
          page-height="{$page-height}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-outer}" 
          margin-right="{$margin-inner}">
                <fo:region-body 
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-even" 
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-even" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <!-- Page sequence master for body content -->
            <fo:page-sequence-master master-name="body">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="blank" blank-or-not-blank="blank"/>
                    <!--
                      Restricted to a recto page. The -first masters carry the
                      RECTO margin pair (inner on the left), because "first page of
                      a module" was assumed to be a right-hand page. page-position
                      "first" actually matches the first page of every
                      page-sequence, so a module beginning on a verso — or, since
                      landscape support splits one module into several sequences,
                      any run that happens to start on one — was laid out with the
                      binding margin on the wrong side and the text block visibly
                      shifted toward the outer edge.

                      A first page that falls on a verso now drops through to the
                      even master, which mirrors the margins and carries the verso
                      running head, exactly as any other left-hand page.
                    -->
                    <fo:conditional-page-master-reference master-reference="body-first" page-position="first" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-odd" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-even" odd-or-even="even"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>
            <!-- Landscape page masters (swap width/height) -->
            <fo:simple-page-master master-name="body-landscape-first" 
          page-width="{$page-height}" 
          page-height="{$page-width}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-inner}" 
          margin-right="{$margin-outer}">
                <fo:region-body 
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-first" 
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-first" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <fo:simple-page-master master-name="body-landscape-odd" 
          page-width="{$page-height}" 
          page-height="{$page-width}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-inner}" 
          margin-right="{$margin-outer}">
                <fo:region-body 
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-odd" 
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-odd" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <fo:simple-page-master master-name="body-landscape-even" 
          page-width="{$page-height}" 
          page-height="{$page-width}" 
          margin-top="{$page-margin-top}" 
          margin-bottom="{$page-margin-bottom}" 
          margin-left="{$margin-outer}" 
          margin-right="{$margin-inner}">
                <fo:region-body 
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-even" 
            extent="{$region-before-extent}" 
            precedence="true" 
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-even" 
            extent="{$region-after-extent}" 
            precedence="true" 
            display-align="after"/>
            </fo:simple-page-master>
            <!--
              A landscape run's own end-on-even padding (page-sequence-landscape's
              $last, and the "landscape boundary" padding in descript.xsl's
              emit-orientation-runs) used to fall to the generic "blank" master
              above — page-width/page-height, i.e. PORTRAIT — because this
              sequence never had a landscape-shaped blank alternative of its
              own. A landscape run needing exactly one padding page therefore
              got a portrait "intentionally left blank" page sandwiched inside
              an otherwise all-landscape run: the one page in the whole
              excursion that did NOT turn with the rest of it. Swapped
              dimensions here, same as body-landscape-odd/even, fixes that.
            -->
            <fo:simple-page-master master-name="body-landscape-blank"
          page-width="{$page-height}"
          page-height="{$page-width}"
          margin-top="{$page-margin-top}"
          margin-bottom="{$page-margin-bottom}"
          margin-left="{$margin-outer}"
          margin-right="{$margin-inner}">
                <fo:region-body display-align="center"
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            background-image="url('{$blank.page.svg}')"
            background-repeat="no-repeat"
            background-position-horizontal="center"
            background-position-vertical="center"/>
                <fo:region-before region-name="xsl-region-before-blank"
            extent="{$region-before-extent}"
            precedence="true"
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-blank"
            extent="{$region-after-extent}"
            precedence="true"
            display-align="after"/>
            </fo:simple-page-master>
            <fo:page-sequence-master master-name="body-landscape">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="body-landscape-blank" blank-or-not-blank="blank"/>
                    <fo:conditional-page-master-reference master-reference="body-landscape-first" page-position="first" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-landscape-odd" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-landscape-even" odd-or-even="even"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>
            <!-- A3 Landscape page masters (420mm wide x 297mm tall) -->
            <fo:simple-page-master master-name="body-a3-landscape-first"
          page-width="420mm"
          page-height="297mm"
          margin-top="{$page-margin-top}"
          margin-bottom="{$page-margin-bottom}"
          margin-left="{$margin-inner}"
          margin-right="{$margin-outer}">
                <fo:region-body
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-first"
            extent="{$region-before-extent}"
            precedence="true"
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-first"
            extent="{$region-after-extent}"
            precedence="true"
            display-align="after"/>
            </fo:simple-page-master>
            <fo:simple-page-master master-name="body-a3-landscape-odd"
          page-width="420mm"
          page-height="297mm"
          margin-top="{$page-margin-top}"
          margin-bottom="{$page-margin-bottom}"
          margin-left="{$margin-inner}"
          margin-right="{$margin-outer}">
                <fo:region-body
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-odd"
            extent="{$region-before-extent}"
            precedence="true"
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-odd"
            extent="{$region-after-extent}"
            precedence="true"
            display-align="after"/>
            </fo:simple-page-master>
            <fo:simple-page-master master-name="body-a3-landscape-even"
          page-width="420mm"
          page-height="297mm"
          margin-top="{$page-margin-top}"
          margin-bottom="{$page-margin-bottom}"
          margin-left="{$margin-outer}"
          margin-right="{$margin-inner}">
                <fo:region-body
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            column-gap="12pt"
            column-count="1">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="xsl-region-before-even"
            extent="{$region-before-extent}"
            precedence="true"
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-even"
            extent="{$region-after-extent}"
            precedence="true"
            display-align="after"/>
            </fo:simple-page-master>
            <!-- Same gap as body-landscape-blank above, same fix: a fixed
                 420x297 blank rather than the generic portrait one. -->
            <fo:simple-page-master master-name="body-a3-landscape-blank"
          page-width="420mm"
          page-height="297mm"
          margin-top="{$page-margin-top}"
          margin-bottom="{$page-margin-bottom}"
          margin-left="{$margin-outer}"
          margin-right="{$margin-inner}">
                <fo:region-body display-align="center"
            margin-bottom="{$body-margin-bottom}"
            margin-top="{$body-margin-top}"
            background-image="url('{$blank.page.svg}')"
            background-repeat="no-repeat"
            background-position-horizontal="center"
            background-position-vertical="center"/>
                <fo:region-before region-name="xsl-region-before-blank"
            extent="{$region-before-extent}"
            precedence="true"
            display-align="before"/>
                <fo:region-after region-name="xsl-region-after-blank"
            extent="{$region-after-extent}"
            precedence="true"
            display-align="after"/>
            </fo:simple-page-master>
            <fo:page-sequence-master master-name="body-a3-landscape">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="body-a3-landscape-blank" blank-or-not-blank="blank"/>
                    <fo:conditional-page-master-reference master-reference="body-a3-landscape-first" page-position="first" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-a3-landscape-odd" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-a3-landscape-even" odd-or-even="even"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>
        </fo:layout-master-set>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    PAGE SEQUENCE TEMPLATE                             -->
    <!-- ==================================================================== -->
    <xsl:template name="page-sequence">
        <xsl:param name="content"/>
        <!--
          0 for every sequence of a data module except the last.

          force-page-count below pads a sequence out to an even page. That is
          right at the END of a data module, but a module split across several
          sequences (portrait / landscape / portrait, see descript.xsl) is still
          ONE module, and padding each part would drop a blank page at every
          seam — before the landscape page and again after it.
        -->
        <xsl:param name="last" select="1"/>
        <xsl:variable name="master">
            <xsl:choose>
                <xsl:when test="ancestor::pmEntry[@id='a3-landscape']">body-a3-landscape</xsl:when>
                <xsl:when test="ancestor::pmEntry[@id='a4-landscape']">body-landscape</xsl:when>
                <xsl:otherwise>body</xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <!--
          force-page-count="end-on-even" makes each data module end on an even
          page, so the NEXT one always opens on a right-hand (recto) page — the
          printing convention the JSS pipeline follows. Where that leaves a gap,
          FOP inserts a page with no flow content, which the "blank" master
          above stamps with the "intentionally left blank" legend.

          Gated by $blank.versos so single-sided output can switch it off and
          avoid the extra sheets entirely.
        -->
        <fo:page-sequence master-reference="{$master}" initial-page-number="auto" format="1">
            <xsl:if test="$blank.versos = '1' and $last = 1">
                <xsl:attribute name="force-page-count">end-on-even</xsl:attribute>
            </xsl:if>
            <!-- Header definitions -->
            <fo:static-content flow-name="xsl-region-before-first">
                <xsl:call-template name="header-content"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-before-odd">
                <xsl:call-template name="header-content"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-before-even">
                <xsl:call-template name="header-content">
                  <xsl:with-param name="verso">1</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <!-- Footer definitions -->
            <fo:static-content flow-name="xsl-region-after-first">
                <xsl:call-template name="footer-content-odd"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-after-odd">
                <xsl:call-template name="footer-content-odd"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-after-even">
                <xsl:call-template name="footer-content-even"/>
            </fo:static-content>
            <!-- Main content flow -->
            <fo:flow flow-name="xsl-region-body" font-size="{$font-size}" font-family="{$font-stack}" line-height="{$line-height}" text-align="justify">
                <xsl:copy-of select="$content"/>
            </fo:flow>
        </fo:page-sequence>
    </xsl:template>
    <xsl:template name="page-sequence-landscape">
        <xsl:param name="content"/>
        <!--
          1 when this landscape run is the LAST sequence of its data module, so
          it carries the module's end-on-even padding. It used to have no such
          parameter at all: a module that ended on a landscape page could not
          pad, so emit-orientation-runs had to open one more portrait sequence
          purely to hold the padding — and that sequence had nothing to put in
          it, which is where the stray empty page after a landscape table came
          from. See "closes-here" in descript.xsl.
        -->
        <xsl:param name="last" select="0"/>
        <fo:page-sequence master-reference="body-landscape" initial-page-number="auto">
            <xsl:if test="$blank.versos = '1' and $last = 1">
                <xsl:attribute name="force-page-count">end-on-even</xsl:attribute>
            </xsl:if>
            <!-- Header definitions -->
            <fo:static-content flow-name="xsl-region-before-first">
                <xsl:call-template name="header-content"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-before-odd">
                <xsl:call-template name="header-content"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-before-even">
                <xsl:call-template name="header-content">
                  <xsl:with-param name="verso">1</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <!--
              Footer definitions. body-landscape-* swaps page-width and
              page-height on the simple-page-master (a landscape page IS the
              portrait one, turned on its side), so the footer's side notes —
              the only thing in it that measures itself against the page —
              need the same swap passed in. Left as the stylesheet defaults,
              a "Produced by" line computed its start against a page 87mm
              taller than the one it was actually drawn on, and rendered
              entirely off it.
            -->
            <fo:static-content flow-name="xsl-region-after-first">
                <xsl:call-template name="footer-content-odd">
                    <xsl:with-param name="page-h" select="$page-width"/>
                    <xsl:with-param name="page-w" select="$page-height"/>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-after-odd">
                <xsl:call-template name="footer-content-odd">
                    <xsl:with-param name="page-h" select="$page-width"/>
                    <xsl:with-param name="page-w" select="$page-height"/>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-after-even">
                <xsl:call-template name="footer-content-even">
                    <xsl:with-param name="page-h" select="$page-width"/>
                    <xsl:with-param name="page-w" select="$page-height"/>
                </xsl:call-template>
            </fo:static-content>
            <!-- Main content flow -->
            <fo:flow flow-name="xsl-region-body" font-size="{$font-size}" font-family="{$font-stack}" line-height="{$line-height}" text-align="justify">
                <xsl:copy-of select="$content"/>
            </fo:flow>
        </fo:page-sequence>
    </xsl:template>
    <xsl:template name="page-sequence-a3-landscape">
        <xsl:param name="content"/>
        <fo:page-sequence master-reference="body-a3-landscape" initial-page-number="auto">
            <!-- Header definitions -->
            <fo:static-content flow-name="xsl-region-before-first">
                <xsl:call-template name="header-content"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-before-odd">
                <xsl:call-template name="header-content"/>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-before-even">
                <xsl:call-template name="header-content">
                  <xsl:with-param name="verso">1</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <!--
              Footer definitions. body-a3-landscape's own masters, just above,
              give its true size in literal mm rather than deriving it from
              $page-width/$page-height at all — 420 x 297, fixed, regardless
              of what those parameters are set to — so the side notes need the
              same two literals, not a swap of the parameters as A4 landscape
              gets a few templates up.
            -->
            <fo:static-content flow-name="xsl-region-after-first">
                <xsl:call-template name="footer-content-odd">
                    <xsl:with-param name="page-h">297mm</xsl:with-param>
                    <xsl:with-param name="page-w">420mm</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-after-odd">
                <xsl:call-template name="footer-content-odd">
                    <xsl:with-param name="page-h">297mm</xsl:with-param>
                    <xsl:with-param name="page-w">420mm</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="xsl-region-after-even">
                <xsl:call-template name="footer-content-even"><xsl:with-param name="page-h">297mm</xsl:with-param><xsl:with-param name="page-w">420mm</xsl:with-param></xsl:call-template>
            </fo:static-content>
            <!-- Main content flow -->
            <fo:flow flow-name="xsl-region-body" font-size="{$font-size}" font-family="{$font-stack}" line-height="{$line-height}" text-align="justify">
                <xsl:copy-of select="$content"/>
            </fo:flow>
        </fo:page-sequence>
    </xsl:template>
    <!-- Generates background-image attributes for fo:region-body when watermark URI is set -->
    <xsl:template name="watermark-bg-attrs">
        <xsl:if test="$watermark.image.uri != ''">
            <xsl:attribute name="background-image">
                <xsl:text>url('</xsl:text>
                <xsl:value-of select="$watermark.image.uri"/>
                <xsl:text>')</xsl:text>
            </xsl:attribute>
            <xsl:attribute name="background-repeat"><xsl:value-of select="$watermark.repeat"/></xsl:attribute>
            <xsl:attribute name="background-position-horizontal">center</xsl:attribute>
            <xsl:attribute name="background-position-vertical">center</xsl:attribute>
        </xsl:if>
    </xsl:template>
</xsl:stylesheet>