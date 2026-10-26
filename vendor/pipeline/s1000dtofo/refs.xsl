<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: References
     
     Contains templates for processing reference tables and 
     cross-references to other data modules.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xlink="http://www.w3.org/1999/xlink">
    <!-- ==================================================================== -->
    <!--                    REFERENCES TABLE                                   -->
    <!-- ==================================================================== -->
    <!-- Note: The main "references" named template is defined in tables.xsl -->
    <xsl:template match="refs">
        <fo:block padding-top="{$standard-leading}">
            <fo:table table-layout="fixed" width="100%" border-collapse="collapse">
                <fo:table-column column-width="60%"/>
                <fo:table-column column-width="40%"/>
                <fo:table-header>
                    <fo:table-row background-color="{$table-header-bg}">
                        <fo:table-cell xsl:use-attribute-sets="table-cell">
                            <fo:block font-weight="bold">Reference</fo:block>
                        </fo:table-cell>
                        <fo:table-cell xsl:use-attribute-sets="table-cell">
                            <fo:block font-weight="bold">Title</fo:block>
                        </fo:table-cell>
                    </fo:table-row>
                </fo:table-header>
                <fo:table-body>
                    <xsl:apply-templates select="*" mode="refs-table"/>
                </fo:table-body>
            </fo:table>
        </fo:block>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    DM REF (In Table)                                  -->
    <!-- ==================================================================== -->
    <xsl:template match="dmRef" mode="refs-table">
        <fo:table-row>
            <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block font-family="{$monospace-stack}">
                    <xsl:apply-templates select="dmRefIdent"/>
                </fo:block>
            </fo:table-cell>
            <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                    <xsl:apply-templates select="dmRefAddressItems/dmTitle"/>
                </fo:block>
            </fo:table-cell>
        </fo:table-row>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    DM REF (Inline)                                    -->
    <!-- ==================================================================== -->
    <!--
      Every data module in the book, keyed by its own dmCode.

      Built as one concat() rather than by calling the formatting template,
      because an xsl:key's `use` has to be a single expression. It must stay
      character-for-character identical to $dmref-key below and to the
      dmRefIdent/dmCode template above — that string equality is what makes a
      reference find its target.

      Deliberately keyed on the dmCode alone, not the file name: the same
      module is stored as "DMC-...-D.xml" in one CSDB and
      "DMC-...-D_001-00_EN-US.XML" in another, and a reference must resolve
      either way.
    -->
    <xsl:key name="dm-by-code" match="dmodule"
        use="concat(identAndStatusSection/dmAddress/dmIdent/dmCode/@modelIdentCode, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@systemDiffCode, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@systemCode, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@subSystemCode,
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@subSubSystemCode, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@assyCode, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@disassyCode,
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@disassyCodeVariant, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@infoCode,
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@infoCodeVariant, '-',
                    identAndStatusSection/dmAddress/dmIdent/dmCode/@itemLocationCode)"/>

    <!--
      A cross-reference to another data module.

      The destination used to be the literal string "references" — an id this
      pipeline never emits anywhere, so every dmRef in every book was an
      unresolvable link and the reader landed on page 1. It now points at the
      target module's own content-start anchor.

      A module the publication does not contain is rendered as plain text
      rather than a link: a reference to something that is not in this book
      cannot go anywhere, and a dead link that looks live is worse than no
      link at all.
    -->
    <xsl:template match="dmRef">
        <xsl:variable name="dmcode">
            <xsl:apply-templates select="dmRefIdent"/>
        </xsl:variable>
        <xsl:variable name="dmref-key"
            select="concat(dmRefIdent/dmCode/@modelIdentCode, '-',
                           dmRefIdent/dmCode/@systemDiffCode, '-',
                           dmRefIdent/dmCode/@systemCode, '-',
                           dmRefIdent/dmCode/@subSystemCode,
                           dmRefIdent/dmCode/@subSubSystemCode, '-',
                           dmRefIdent/dmCode/@assyCode, '-',
                           dmRefIdent/dmCode/@disassyCode,
                           dmRefIdent/dmCode/@disassyCodeVariant, '-',
                           dmRefIdent/dmCode/@infoCode,
                           dmRefIdent/dmCode/@infoCodeVariant, '-',
                           dmRefIdent/dmCode/@itemLocationCode)"/>
        <xsl:variable name="target" select="key('dm-by-code', $dmref-key)[1]"/>
        <xsl:choose>
            <xsl:when test="not($target)">
                <fo:inline>
                    <xsl:call-template name="dmref-label">
                        <xsl:with-param name="dmcode" select="$dmcode"/>
                    </xsl:call-template>
                </fo:inline>
            </xsl:when>
            <xsl:otherwise>
                <fo:basic-link internal-destination="content-start-{generate-id($target)}"
                               color="{$color-link}" text-decoration="underline">
                    <xsl:call-template name="dmref-label">
                        <xsl:with-param name="dmcode" select="$dmcode"/>
                    </xsl:call-template>
                </fo:basic-link>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- The visible text of a dmRef, shared by the linked and unlinked forms. -->
    <xsl:template name="dmref-label">
        <xsl:param name="dmcode"/>
        <fo:inline>
            <xsl:choose>
                <xsl:when test="$dmref.show.title != 0 and dmRefAddressItems/dmTitle">
                    <xsl:value-of select="dmRefAddressItems/dmTitle/techName"/>
                    <xsl:if test="dmRefAddressItems/dmTitle/infoName">
                        <xsl:text> - </xsl:text>
                        <xsl:value-of select="dmRefAddressItems/dmTitle/infoName"/>
                    </xsl:if>
                    <xsl:text> (</xsl:text>
                    <fo:inline font-family="{$monospace-stack}" font-size="85%">
                        <xsl:value-of select="$dmcode"/>
                    </fo:inline>
                    <xsl:text>)</xsl:text>
                </xsl:when>
                <xsl:otherwise>
                    <!--
                      A dmCode is a long, unbroken run of hyphenated segments
                      with no spaces — the only place FOP can ever break it is
                      after one of those hyphens. Inside a narrow table
                      column (a "related module" cell, typically) that meant
                      three or four short, ragged lines at the monospace
                      stack's normal size. Shrinking it doesn't stop the
                      breaks, but it needs noticeably fewer of them to fit the
                      same column — the difference between one wrap and three.
                    -->
                    <fo:inline font-family="{$monospace-stack}" font-size="85%">
                        <xsl:value-of select="$dmcode"/>
                    </fo:inline>
                </xsl:otherwise>
            </xsl:choose>
        </fo:inline>
    </xsl:template>
    <xsl:template match="dmRefIdent">
        <xsl:if test="identExtension">
            <xsl:value-of select="identExtension/@extensionProducer"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="identExtension/@extensionCode"/>
            <xsl:text>-</xsl:text>
        </xsl:if>
        <xsl:apply-templates select="dmCode"/>
    </xsl:template>
    <xsl:template match="dmRefIdent/dmCode">
        <xsl:value-of select="@modelIdentCode"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@systemDiffCode"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@systemCode"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@subSystemCode"/>
        <xsl:value-of select="@subSubSystemCode"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@assyCode"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@disassyCode"/>
        <xsl:value-of select="@disassyCodeVariant"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@infoCode"/>
        <xsl:value-of select="@infoCodeVariant"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@itemLocationCode"/>
    </xsl:template>
    <xsl:template match="dmRefAddressItems/dmTitle">
        <xsl:value-of select="techName"/>
        <xsl:if test="infoName">
            <xsl:text> - </xsl:text>
            <xsl:value-of select="infoName"/>
        </xsl:if>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    PM REF (In Table)                                  -->
    <!-- ==================================================================== -->
    <xsl:template match="pmRef" mode="refs-table">
        <fo:table-row>
            <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block font-family="{$monospace-stack}">
                    <xsl:apply-templates select="pmRefIdent/pmCode"/>
                </fo:block>
            </fo:table-cell>
            <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                    <xsl:apply-templates select="pmRefAddressItems/pmTitle"/>
                </fo:block>
            </fo:table-cell>
        </fo:table-row>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    PM REF (Inline)                                    -->
    <!-- ==================================================================== -->
    <!--
      A reference to another PUBLICATION, not to anything inside this one, so
      there is nothing in this document to jump to. It used to be a link to the
      id "references", which this pipeline never emits — an unresolvable
      destination that FOP silently turns into "go to page 1".

      Rendered as plain text instead: the citation still prints in full, it
      just no longer pretends to be clickable.
    -->
    <xsl:template match="pmRef">
        <fo:inline color="{$color-link}">
            <xsl:choose>
                <xsl:when test="$pmref.show.title != 0 and pmRefAddressItems/pmTitle">
                    <xsl:value-of select="pmRefAddressItems/pmTitle"/>
                    <xsl:text> (</xsl:text>
                    <fo:inline font-family="{$monospace-stack}">
                        <xsl:apply-templates select="pmRefIdent/pmCode"/>
                    </fo:inline>
                    <xsl:text>)</xsl:text>
                </xsl:when>
                <xsl:otherwise>
                    <fo:inline font-family="{$monospace-stack}">
                        <xsl:apply-templates select="pmRefIdent/pmCode"/>
                    </fo:inline>
                </xsl:otherwise>
            </xsl:choose>
        </fo:inline>
    </xsl:template>
    <xsl:template match="pmCode">
        <xsl:value-of select="@modelIdentCode"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@pmIssuer"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@pmNumber"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="@pmVolume"/>
    </xsl:template>
    <xsl:template match="pmTitle">
        <xsl:apply-templates/>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    EXTERNAL PUB REF (In Table)                        -->
    <!-- ==================================================================== -->
    <xsl:template match="externalPubRef" mode="refs-table">
        <fo:table-row>
            <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                    <xsl:apply-templates select="externalPubRefIdent/externalPubCode"/>
                </fo:block>
            </fo:table-cell>
            <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                    <xsl:apply-templates select="externalPubRefIdent/externalPubTitle"/>
                </fo:block>
            </fo:table-cell>
        </fo:table-row>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    EXTERNAL PUB REF (Inline)                          -->
    <!-- ==================================================================== -->
    <xsl:template match="externalPubRef">
        <fo:basic-link color="{$color-link}" text-decoration="underline">
            <xsl:attribute name="external-destination">
                <xsl:choose>
                    <xsl:when test="@xlink:href">
                        <xsl:value-of select="concat(&quot;url('&quot;, normalize-space(@xlink:href), &quot;')&quot;)"/>
                    </xsl:when>
                    <xsl:otherwise>url('')</xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
            <xsl:choose>
                <xsl:when test="externalPubRefIdent/externalPubTitle">
                    <xsl:apply-templates select="externalPubRefIdent/externalPubTitle"/>
                    <xsl:if test="externalPubRefIdent/externalPubCode">
                        <xsl:text> (</xsl:text>
                        <xsl:apply-templates select="externalPubRefIdent/externalPubCode"/>
                        <xsl:text>)</xsl:text>
                    </xsl:if>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:apply-templates select="externalPubRefIdent/externalPubCode"/>
                </xsl:otherwise>
            </xsl:choose>
        </fo:basic-link>
    </xsl:template>
    <xsl:template match="externalPubCode">
        <fo:inline font-family="{$monospace-stack}">
            <xsl:apply-templates/>
        </fo:inline>
    </xsl:template>
    <xsl:template match="externalPubTitle">
        <fo:inline font-style="italic">
            <xsl:apply-templates/>
        </fo:inline>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                 INTERNAL REF DESTINATION RESOLVER                    -->
    <!-- ==================================================================== -->
    <!--
      figure/warning/caution/danger/applic/hotspot keep their authored id on the
      first element that carries it (see unique-id-attr), so a reference to one
      is the bare id and always lands on a real destination. Everything else is
      dmCode-scoped and has to be resolved the same way it was emitted.
    -->
    <xsl:template name="resolve-internal-ref-target-id">
        <xsl:param name="target"/>
        <xsl:variable name="target-element" select="key('by-id', $target)[1]"/>
        <xsl:choose>
            <xsl:when test="$target-element[self::figure or self::warning or self::caution or self::danger or self::applic or self::hotspot]">
                <xsl:value-of select="$target"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:call-template name="generate-link-id">
                    <xsl:with-param name="localId" select="$target"/>
                </xsl:call-template>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    INTERNAL REF                                       -->
    <!-- ==================================================================== -->
    <xsl:template match="internalRef">
        <xsl:variable name="target" select="@internalRefId"/>
        <!--
          Scoped to THIS data module, and to one node.

          An internalRef points within its own module, and ids are only unique
          within one: every module in a publication authors its own
          "fig-0001", and xi:include puts them all in a single tree before the
          transform runs. //*[@id = $target] therefore matched one node PER
          MODULE, and the for-each below printed a number for every one of
          them — which is how a reference to figure 1 came out on the page as
          "Figure 1111111111111" in a thirteen-module book.

          The second half of the union is the fallback for a reference outside
          any data module, where there is no module to scope to.
        -->
        <xsl:variable name="dm" select="ancestor::dmodule"/>
        <xsl:variable name="target-element"
            select="($dm//*[@id = $target] | //*[@id = $target][not($dm)])[1]"/>
        <!--
          What KIND of thing is being referenced.

          @internalRefTargetType when the author supplied it, and otherwise
          worked out from the element the reference actually lands on.

          The attribute is optional in S1000D and is frequently absent: 62
          references in one real workspace carried neither a target type nor
          any wording of their own, and every one of them fell through to the
          bottom of this choose and printed its raw id into the page. "Refer to
          dmqhrb9i-fig-0002" is not a cross-reference, it is a leak of the
          document's plumbing — and it was hiding in plain sight while ids were
          short enough ("fig-0002") to be mistaken for a label.

          Inferring it costs nothing: $target-element has already been
          resolved, so the element's own name answers the question the missing
          attribute was supposed to. Only kinds that HAVE a numbering template
          are inferred — a plain <para> has none, and claiming irtt08 for one
          would make the numbering fall through to XSLT's built-in rule and
          print the paragraph's entire text.
        -->
        <xsl:variable name="kind">
            <xsl:choose>
                <xsl:when test="@internalRefTargetType">
                    <xsl:value-of select="@internalRefTargetType"/>
                </xsl:when>
                <xsl:when test="$target-element[self::figure]">irtt01</xsl:when>
                <xsl:when test="$target-element[self::table]">irtt02</xsl:when>
                <xsl:when test="$target-element[self::multimedia]">irtt03</xsl:when>
                <xsl:when test="$target-element[self::levelledPara]">irtt08</xsl:when>
                <xsl:when test="$target-element[self::proceduralStep]">irtt09</xsl:when>
                <xsl:when test="$target-element[self::graphic]">irtt10</xsl:when>
                <xsl:when test="$target-element[self::hotspot]">irtt11</xsl:when>
                <xsl:otherwise/>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="link-id">
            <xsl:call-template name="resolve-internal-ref-target-id">
                <xsl:with-param name="target" select="$target"/>
            </xsl:call-template>
        </xsl:variable>
        <fo:basic-link internal-destination="{$link-id}" color="{$color-link}">
            <xsl:choose>
                <!--
                  Wording the author supplied wins. An internalRef may carry
                  its own text ("see the block diagram"), and printing
                  "Figure 3" over the top of it discards what they wrote.
                -->
                <xsl:when test="normalize-space(.)">
                    <xsl:apply-templates/>
                </xsl:when>
                <xsl:when test="$kind = 'irtt01'">
                    <!-- Figure. Numbered by the same template the CAPTION
                         uses, so the reference and the figure it points at
                         cannot disagree, and so the continuous/per-module
                         numbering setting reaches references too. -->
                    <xsl:text>Figure </xsl:text>
                    <xsl:for-each select="$target-element">
                        <xsl:apply-templates select="." mode="number"/>
                    </xsl:for-each>
                </xsl:when>
                <xsl:when test="$kind = 'irtt02'">
                    <!-- Table, numbered by the caption's own template for the
                         same reason. -->
                    <xsl:text>Table </xsl:text>
                    <xsl:for-each select="$target-element">
                        <xsl:apply-templates select="." mode="number"/>
                    </xsl:for-each>
                </xsl:when>
                <xsl:when test="$kind = 'irtt03'">
                    <!-- Multimedia -->
                    <xsl:text>Multimedia </xsl:text>
                    <xsl:for-each select="$target-element">
                        <xsl:number count="multimedia" level="any" from="dmodule"/>
                    </xsl:for-each>
                </xsl:when>
                <xsl:when test="$kind = 'irtt04'">
                    <!-- Supply -->
                    <xsl:text>Supply </xsl:text>
                    <xsl:value-of select="$target-element/name"/>
                </xsl:when>
                <xsl:when test="$kind = 'irtt05'">
                    <!-- Supply Group -->
                    <xsl:text>Supply Group</xsl:text>
                </xsl:when>
                <xsl:when test="$kind = 'irtt06'">
                    <!-- Spare -->
                    <xsl:text>Spare </xsl:text>
                    <xsl:value-of select="$target-element/name"/>
                </xsl:when>
                <xsl:when test="$kind = 'irtt07'">
                    <!-- Spare Group -->
                    <xsl:text>Spare Group</xsl:text>
                </xsl:when>
                <xsl:when test="$kind = 'irtt08'">
                    <!-- Para -->
                    <xsl:text>Para </xsl:text>
                    <xsl:for-each select="$target-element">
                        <xsl:apply-templates select="." mode="number"/>
                    </xsl:for-each>
                </xsl:when>
                <xsl:when test="$kind = 'irtt09'">
                    <!-- Step -->
                    <xsl:text>Step </xsl:text>
                    <xsl:for-each select="$target-element">
                        <xsl:apply-templates select="." mode="number"/>
                    </xsl:for-each>
                </xsl:when>
                <xsl:when test="$kind = 'irtt10'">
                    <!-- Graphic -->
                    <xsl:text>Graphic </xsl:text>
                    <xsl:for-each select="$target-element">
                        <xsl:number count="graphic" level="any" from="figure"/>
                    </xsl:for-each>
                </xsl:when>
                <xsl:when test="$kind = 'irtt11'">
                    <!-- Hotspot -->
                    <xsl:text>Hotspot </xsl:text>
                    <xsl:value-of select="$target"/>
                </xsl:when>
                <!--
                  Nothing could be inferred: an unresolvable id, or a target
                  with no numbering of its own. Its TITLE at least names
                  something the reader can find; the id names nothing outside
                  the file. The id remains the last resort, because a reference
                  that prints nothing at all is worse than an ugly one.
                -->
                <xsl:when test="$target-element/title">
                    <xsl:value-of select="normalize-space($target-element/title)"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="$target"/>
                </xsl:otherwise>
            </xsl:choose>
        </fo:basic-link>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    FOOTNOTE REF                                       -->
    <!-- ==================================================================== -->
    <!--
      Numeric baseline-shift, not the "super" keyword — see the note on
      superScript in common.xsl. The keyword form grows the line it sits on,
      which put a paragraph carrying a footnote reference out of step with
      the ones around it, exactly like a superScript would.
    -->
    <xsl:template match="footnoteRef">
        <xsl:variable name="fnref" select="@internalRefId"/>
        <xsl:variable name="fn" select="//footnote[@id = $fnref]"/>
        <fo:footnote>
            <fo:inline baseline-shift="0.3em" font-size="70%">
                <xsl:for-each select="$fn">
                    <xsl:number count="footnote" level="any" from="dmodule"/>
                </xsl:for-each>
            </fo:inline>
            <fo:footnote-body>
                <fo:block font-size="{$footnote-size}">
                    <fo:inline baseline-shift="0.3em" font-size="70%">
                        <xsl:for-each select="$fn">
                            <xsl:number count="footnote" level="any" from="dmodule"/>
                        </xsl:for-each>
                    </fo:inline>
                    <xsl:text> </xsl:text>
                    <xsl:apply-templates select="$fn/*"/>
                </fo:block>
            </fo:footnote-body>
        </fo:footnote>
    </xsl:template>
    <!--
      footnote itself lives in common.xsl, with the rest of the notice/marker
      templates and the fix for the same keyword baseline-shift bug that
      footnoteRef above carries.

      A SECOND template for it lived here, at the same import precedence and
      the same priority as the one in common.xsl - an outright conflict that
      xsltproc resolved silently by taking whichever stylesheet happened to
      be included last, which was this one. This copy rendered nothing, so
      every <footnote> authored directly at its point of citation - the
      ordinary way to write one - vanished from the PDF with no warning:
      not the marker, not the note, not an "unhandled element" line in the
      build log. Only a footnote reached by a SEPARATE <footnoteRef>
      elsewhere ever printed anything.
    -->
    <!-- ==================================================================== -->
    <!--                    REFERENCED APPLICABILITY GROUP                     -->
    <!-- ==================================================================== -->
    <xsl:template match="referencedApplicGroup">
        <fo:block padding-top="{$standard-leading}">
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>
    <xsl:template match="applic[@id]">
        <fo:block padding-top="3pt">
            <xsl:call-template name="unique-id-attr"/>
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    APPLICABILITY CROSS REF TABLE REF                  -->
    <!-- ==================================================================== -->
    <xsl:template match="applicCrossRefTableRef">
        <fo:block padding-top="3pt">
            <fo:inline font-weight="bold">ACT Reference: </fo:inline>
            <xsl:apply-templates select="dmRef"/>
        </fo:block>
    </xsl:template>
</xsl:stylesheet>